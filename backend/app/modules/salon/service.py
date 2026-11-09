"""Reglas de negocio del módulo salón. No conoce HTTP: lanza errores de dominio."""

from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.reservas import Reserva
from app.models.salon import Mesa, Sector
from app.modules.salon.repository import MesaRepository, SectorRepository
from app.modules.salon.schemas import (
    MesaCreate,
    MesaOut,
    MesaUpdate,
    SectorCreate,
    SectorOut,
    SectorUpdate,
)


class SectorService:
    """HU-01a: gestión de sectores del salón."""

    def __init__(self, db: Session):
        self.db = db
        self.sectores = SectorRepository(db)

    def listar(self) -> list[SectorOut]:
        """CA6: sectores activos con nombre, descripción y cantidad de mesas activas."""
        return [
            self._a_salida(sector, cantidad)
            for sector, cantidad in self.sectores.listar_activos_con_cantidad()
        ]

    def crear(self, datos: SectorCreate) -> SectorOut:
        """CA1 y CA2: crea el sector si no hay otro activo con ese nombre."""
        self._validar_unico(datos.nombre)
        sector = Sector(nombre=datos.nombre, descripcion=datos.descripcion, activo=True)
        self.db.add(sector)
        self.db.commit()
        return self._a_salida(sector, 0)

    def modificar(self, sector_id: int, datos: SectorUpdate) -> SectorOut:
        """CA3: actualiza nombre y descripción, volviendo a validar el CA2."""
        sector = self._obtener(sector_id)
        self._validar_unico(datos.nombre, excluir_id=sector.id)
        sector.nombre = datos.nombre
        sector.descripcion = datos.descripcion
        self.db.commit()
        return self._a_salida(sector, self.sectores.contar_mesas_activas(sector.id))

    def eliminar(self, sector_id: int) -> None:
        """CA4 y CA5: baja lógica, salvo que el sector tenga mesas activas."""
        sector = self._obtener(sector_id)
        mesas = self.sectores.contar_mesas_activas(sector.id)
        if mesas > 0:
            cantidad = "1 mesa activa" if mesas == 1 else f"{mesas} mesas activas"
            raise ConflictError(
                f"No se puede eliminar el sector {sector.nombre}: tiene {cantidad}. "
                "Primero reubicá o eliminá sus mesas",
                "SECTOR_CON_MESAS",
            )
        sector.activo = False
        self.db.commit()

    def _obtener(self, sector_id: int) -> Sector:
        sector = self.sectores.obtener_activo(sector_id)
        if sector is None:
            raise NotFoundError("El sector no existe", "SECTOR_NO_ENCONTRADO")
        return sector

    def _validar_unico(self, nombre: str, excluir_id: int | None = None) -> None:
        if self.sectores.buscar_activo_por_nombre(nombre, excluir_id):
            raise ConflictError(
                "Ya existe un sector con ese nombre", "SECTOR_DUPLICADO"
            )

    @staticmethod
    def _a_salida(sector: Sector, cantidad: int) -> SectorOut:
        return SectorOut(
            id=sector.id,
            nombre=sector.nombre,
            descripcion=sector.descripcion,
            cantidad_mesas=cantidad,
        )


def _describir_reserva(reserva: Reserva) -> str:
    return f"la reserva #{reserva.id} del {reserva.fecha_hora:%d/%m/%Y %H:%M}"


class MesaService:
    """HU-01b: gestión de las mesas de cada sector."""

    def __init__(self, db: Session):
        self.db = db
        self.mesas = MesaRepository(db)
        self.sectores = SectorRepository(db)

    def listar(self, sector_id: int | None = None) -> list[MesaOut]:
        """CA8: mesas activas (opcionalmente de un sector) con su disponibilidad."""
        return self._con_disponibilidad(self.mesas.listar_activas(sector_id))

    def crear(self, datos: MesaCreate) -> MesaOut:
        """CA1 a CA3: crea la mesa activa en un sector activo."""
        self._validar_capacidad(datos.capacidad)
        sector = self._validar_sector(datos.sector_id)
        self._validar_numero_unico(datos.numero)
        mesa = Mesa(
            numero=datos.numero,
            capacidad=datos.capacidad,
            sector_id=sector.id,
            activo=True,
        )
        self.db.add(mesa)
        self.db.commit()
        self.db.refresh(mesa)
        return self._a_salida(mesa, "LIBRE")

    def modificar(self, mesa_id: int, datos: MesaUpdate) -> MesaOut:
        """CA2 a CA5: cambia número, capacidad o sector de una mesa sin comanda abierta.

        CA5: si la mesa tiene reservas activas, la capacidad no puede quedar por
        debajo de los comensales de ninguna. Si la reserva ocupa varias mesas, se
        compara con la capacidad sumada de todas ellas.
        """
        mesa = self._obtener(mesa_id)
        comandas = self.mesas.comandas_abiertas(mesa.id)
        if comandas:
            raise ConflictError(
                f"No se puede modificar la mesa {mesa.numero}: "
                f"tiene la comanda #{comandas[0].id} abierta",
                "MESA_CON_COMANDA",
            )
        self._validar_capacidad(datos.capacidad)
        sector = self._validar_sector(datos.sector_id)
        self._validar_numero_unico(datos.numero, excluir_id=mesa.id)
        if datos.capacidad < mesa.capacidad:
            self._validar_reservas(mesa, datos.capacidad)

        mesa.numero = datos.numero
        mesa.capacidad = datos.capacidad
        mesa.sector_id = sector.id
        self.db.commit()
        self.db.refresh(mesa)
        return self._con_disponibilidad([mesa])[0]

    def eliminar(self, mesa_id: int) -> None:
        """CA6 y CA7: baja lógica, salvo que tenga reservas activas o comanda abierta.

        El mensaje de éxito ("Se dio de baja la mesa N") lo muestra el front.
        """
        mesa = self._obtener(mesa_id)
        motivos = [
            f"tiene la comanda #{c.id} abierta"
            for c in self.mesas.comandas_abiertas(mesa.id)
        ] + [
            f"tiene {_describir_reserva(r)} activa"
            for r in self.mesas.reservas_activas(mesa.id)
        ]
        if motivos:
            raise ConflictError(
                f"No se puede eliminar la mesa {mesa.numero}: {', '.join(motivos)}",
                "MESA_EN_USO",
            )
        mesa.activo = False
        self.db.commit()

    def _con_disponibilidad(self, mesas: list[Mesa]) -> list[MesaOut]:
        """OCUPADA si tiene una comanda abierta, RESERVADA si tiene una reserva
        activa para hoy y LIBRE en otro caso."""
        ids = [m.id for m in mesas]
        ocupadas = self.mesas.ids_con_comanda_abierta(ids)
        reservadas = self.mesas.ids_reservadas_el_dia(ids, date.today())

        def disponibilidad(mesa: Mesa) -> str:
            if mesa.id in ocupadas:
                return "OCUPADA"
            if mesa.id in reservadas:
                return "RESERVADA"
            return "LIBRE"

        return [self._a_salida(m, disponibilidad(m)) for m in mesas]

    def _obtener(self, mesa_id: int) -> Mesa:
        mesa = self.mesas.obtener_activa(mesa_id)
        if mesa is None:
            raise NotFoundError("La mesa no existe", "MESA_NO_ENCONTRADA")
        return mesa

    @staticmethod
    def _validar_capacidad(capacidad: int) -> None:
        """CA3."""
        if capacidad <= 0:
            raise BusinessRuleError(
                "La capacidad debe ser mayor a 0", "CAPACIDAD_INVALIDA"
            )

    def _validar_sector(self, sector_id: int) -> Sector:
        sector = self.sectores.obtener_activo(sector_id)
        if sector is None:
            raise BusinessRuleError(
                "El sector elegido no existe o fue eliminado", "SECTOR_INVALIDO"
            )
        return sector

    def _validar_numero_unico(self, numero: int, excluir_id: int | None = None) -> None:
        """CA2."""
        if self.mesas.buscar_activa_por_numero(numero, excluir_id):
            raise ConflictError(
                f"Ya existe una mesa activa con el número {numero}", "MESA_DUPLICADA"
            )

    def _validar_reservas(self, mesa: Mesa, capacidad: int) -> None:
        """CA5."""
        for reserva in self.mesas.reservas_activas(mesa.id):
            otras = sum(m.capacidad for m in reserva.mesas if m.id != mesa.id)
            if otras + capacidad < reserva.cantidad_comensales:
                raise ConflictError(
                    f"No se puede reducir la capacidad de la mesa {mesa.numero} "
                    f"a {capacidad}: {_describir_reserva(reserva)} es para "
                    f"{reserva.cantidad_comensales} comensales",
                    "MESA_CON_RESERVA",
                )

    @staticmethod
    def _a_salida(mesa: Mesa, disponibilidad: str) -> MesaOut:
        return MesaOut(
            id=mesa.id,
            numero=mesa.numero,
            capacidad=mesa.capacidad,
            sector_id=mesa.sector_id,
            sector_nombre=mesa.sector.nombre,
            disponibilidad=disponibilidad,
        )
