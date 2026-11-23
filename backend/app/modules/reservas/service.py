"""Reglas de negocio de reservas (HU-11a registro, HU-11b atención)."""

from datetime import datetime, timedelta
from decimal import Decimal
from math import ceil

from sqlalchemy.orm import Session

from app.core.enums import EstadoReserva, TipoProducto
from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.comandas import Comanda
from app.models.reservas import DetalleMenuAcordado, MenuAcordado, Reserva, Sena
from app.models.salon import Mesa
from app.modules.comandas.repository import ComandaRepository
from app.modules.comandas.service import ComandaService
from app.modules.reservas.repository import ReservaRepository
from app.modules.reservas.schemas import (
    ClienteResumen,
    ItemMenuAcordado,
    ItemMenuOut,
    MesaResumen,
    ReservaCrear,
    ReservaDatos,
    ReservaFiltros,
    ReservaOut,
    SenaOut,
)

# La fecha y hora solicitada de la reserva actúa como límite de vigencia.
TOLERANCIA = timedelta(minutes=0)
DURACION_FIJA_HORAS = 1
SENA_MINIMA = Decimal("1000")
SENA_MAXIMA = Decimal("10000")


class ReservaService:
    def __init__(self, db: Session):
        self.db = db
        self.reservas = ReservaRepository(db)

    # ---------- HU-11a ----------
    def listar(self, filtros: ReservaFiltros) -> list[ReservaOut]:
        """CA11: reservas ordenadas por fecha y hora, con filtros opcionales."""
        self.reservas.marcar_vencidas_ausentes()
        lista = self.reservas.listar(
            filtros.fecha, filtros.estado, filtros.cliente_id, filtros.sin_comanda
        )
        return [self._a_salida(r) for r in lista]

    def obtener(self, reserva_id: int) -> ReservaOut:
        self.reservas.marcar_vencidas_ausentes()
        return self._a_salida(self._buscar(reserva_id))

    def crear(self, datos: ReservaCrear) -> ReservaOut:
        """CA1 a CA8: crea la reserva ACTIVA con su seña y su menú acordado."""
        mesas = self._validar(datos)
        if datos.sena is None:
            raise BusinessRuleError(
                "La reserva necesita una seña", "SENA_OBLIGATORIA"
            )  # CA6
        medio_pago = self.reservas.buscar_medio_pago(datos.sena.medio_pago_id)
        if not (SENA_MINIMA <= datos.sena.monto <= SENA_MAXIMA):
            raise BusinessRuleError(
                f"El monto de la seña tiene que estar entre {SENA_MINIMA} y "
                f"{SENA_MAXIMA} pesos",
                "SENA_INVALIDA",
            )
        if medio_pago is None or not medio_pago.activo:
            raise BusinessRuleError(
                "El medio de pago de la seña no existe o está inactivo",
                "SENA_INVALIDA",
            )
        detalles = self._validar_menu(datos.menu_acordado)

        reserva = Reserva(
            fecha_hora=datetime.combine(datos.fecha, datos.hora),
            duracion_horas=DURACION_FIJA_HORAS,
            cantidad_comensales=datos.cantidad_comensales,
            cliente_id=datos.cliente_id,
            estado=EstadoReserva.ACTIVA,
            mesas=mesas,
            sena=Sena(monto=datos.sena.monto, medio_pago_id=medio_pago.id),
        )
        if detalles:
            reserva.menu_acordado = MenuAcordado(detalles=detalles)
        return self._a_salida(self.reservas.guardar(reserva))

    def modificar(self, reserva_id: int, datos: ReservaDatos) -> ReservaOut:
        """CA9: solo reservas ACTIVAS; vuelve a validar CA2 a CA5 (y el menú)."""
        reserva = self._activa(reserva_id)
        mesas = self._validar(datos, excluir_id=reserva.id)
        detalles = self._validar_menu(datos.menu_acordado)

        reserva.fecha_hora = datetime.combine(datos.fecha, datos.hora)
        reserva.duracion_horas = DURACION_FIJA_HORAS
        reserva.cantidad_comensales = datos.cantidad_comensales
        reserva.cliente_id = datos.cliente_id
        reserva.mesas = mesas
        if not detalles:
            reserva.menu_acordado = None
        elif reserva.menu_acordado is None:
            reserva.menu_acordado = MenuAcordado(detalles=detalles)
        else:
            reserva.menu_acordado.detalles = detalles
        return self._a_salida(self.reservas.guardar(reserva))

    def cancelar(self, reserva_id: int) -> ReservaOut:
        """CA10: cancelación anticipada; la seña se devuelve y las mesas se liberan."""
        reserva = self._activa(reserva_id)
        if datetime.now() >= reserva.fecha_hora:
            raise BusinessRuleError(
                "El horario de la reserva ya llegó: registrá la llegada o la ausencia",
                "RESERVA_VENCIDA",
            )
        reserva.estado = EstadoReserva.CANCELADA
        if reserva.sena is not None:
            reserva.sena.devuelta = True
        return self._a_salida(self.reservas.guardar(reserva))

    # ---------- HU-11b ----------
    def registrar_llegada(self, reserva_id: int) -> ReservaOut:
        """CA1: pasa a CUMPLIDA, abre la comanda y precarga el menú acordado."""
        reserva = self._activa(reserva_id)
        mesas = list(reserva.mesas)
        ocupadas = ComandaRepository(self.db).numeros_de_mesas_ocupadas(mesas)
        if ocupadas:
            raise ConflictError(
                f"Las mesas {ocupadas} se encuentran ocupadas", "MESA_OCUPADA"
            )
        reserva.estado = EstadoReserva.CUMPLIDA
        reserva.fecha_hora_llegada = datetime.now()
        if reserva.comanda is None and mesas:
            mozo = self.reservas.obtener_mozo_para_mesas(mesas)
            comanda = Comanda(
                cantidad_comensales=reserva.cantidad_comensales,
                mozo=mozo,
                mesas=mesas,
                reserva=reserva,
            )
            if reserva.menu_acordado is not None:
                ComandaService(self.db)._cargar_menu_acordado(comanda, reserva)
            self.db.add(comanda)
        return self._a_salida(self.reservas.guardar(reserva))

    def registrar_ausencia(self, reserva_id: int) -> ReservaOut:
        """CA2 y CA3: pasa a AUSENTE al alcanzar la vigencia; seña no se devuelve."""
        reserva = self._activa(reserva_id)
        vence = reserva.fecha_hora + TOLERANCIA
        ahora = datetime.now()
        if ahora < vence:
            minutos = ceil((vence - ahora).total_seconds() / 60)
            raise BusinessRuleError(
                f"Todavía no venció la tolerancia: faltan {minutos} minutos",
                "TOLERANCIA_NO_VENCIDA",
            )
        reserva.estado = EstadoReserva.AUSENTE
        return self._a_salida(self.reservas.guardar(reserva))

    # ---------- validaciones ----------
    def _buscar(self, reserva_id: int) -> Reserva:
        reserva = self.reservas.obtener(reserva_id)
        if reserva is None:
            raise NotFoundError("La reserva no existe", "RESERVA_NO_ENCONTRADA")
        return reserva

    def _activa(self, reserva_id: int) -> Reserva:
        """HU-11b CA4: una reserva Cumplida, Cancelada o Ausente ya no se toca."""
        reserva = self._buscar(reserva_id)
        if reserva.estado != EstadoReserva.ACTIVA:
            raise ConflictError(
                f"La reserva está {reserva.estado.lower()}: no se puede modificar",
                "RESERVA_CERRADA",
            )
        return reserva

    def _validar(self, datos: ReservaDatos, excluir_id: int | None = None) -> list:
        if (
            datos.hora.minute != 0
            or datos.hora.second != 0
            or datos.hora.hour < 10
            or datos.hora.hour > 23
        ):
            raise BusinessRuleError(
                "El horario de la reserva debe ser en punto (HH:00) "
                "entre las 10:00 y las 23:00",
                "HORA_INVALIDA",
            )
        inicio = datetime.combine(datos.fecha, datos.hora)
        if inicio <= datetime.now():  # CA4
            raise BusinessRuleError(
                "La fecha y hora de la reserva ya pasaron", "FECHA_INVALIDA"
            )
        cliente = self.reservas.buscar_cliente(datos.cliente_id)
        if cliente is None or not cliente.activo:  # CA5
            raise BusinessRuleError(
                "El cliente no existe o fue dado de baja: primero registralo",
                "CLIENTE_INEXISTENTE",
            )
        mesas = self.reservas.buscar_mesas(datos.numeros_mesa)
        faltantes = sorted(set(datos.numeros_mesa) - {m.numero for m in mesas})
        if faltantes:
            raise BusinessRuleError(
                f"Las mesas {faltantes} no existen o están eliminadas",
                "MESA_INEXISTENTE",
            )
        if len({m.sector_id for m in mesas}) > 1:
            raise BusinessRuleError(
                "Las mesas elegidas deben pertenecer al mismo espacio/sector",
                "MESAS_DISTINTO_SECTOR",
            )
        capacidad = sum(m.capacidad for m in mesas)
        if capacidad < datos.cantidad_comensales:  # CA3
            raise BusinessRuleError(
                f"Las mesas elegidas tienen {capacidad} lugares: faltan "
                f"{datos.cantidad_comensales - capacidad} para "
                f"{datos.cantidad_comensales} comensales",
                "CAPACIDAD_INSUFICIENTE",
            )
        self.reservas.marcar_vencidas_ausentes()
        fin = inicio + timedelta(hours=DURACION_FIJA_HORAS)
        self._validar_disponibilidad(mesas, inicio, fin, excluir_id)  # CA2
        return mesas

    def _validar_disponibilidad(
        self,
        mesas: list[Mesa],
        inicio: datetime,
        fin: datetime,
        excluir_id: int | None,
    ) -> None:
        ids = {m.id for m in mesas}
        for otra in self.reservas.activas_en_mesas(list(ids), excluir_id):
            if otra.fecha_hora < fin and inicio < otra.fecha_hora_fin:
                ocupada = min(m.numero for m in otra.mesas if m.id in ids)
                raise ConflictError(
                    f"La mesa {ocupada} ya está reservada en ese horario "
                    f"(reserva {otra.id}, {otra.fecha_hora:%d/%m %H:%M})",
                    "MESA_NO_DISPONIBLE",
                )

    def _validar_menu(self, items: list[ItemMenuAcordado]) -> list[DetalleMenuAcordado]:
        """CA7 y CA8: platos activos, cantidad y precio acordado mayores a 0."""
        detalles = []
        for item in items:
            producto = self.reservas.buscar_producto(item.producto_id)
            if (
                producto is None
                or not producto.disponible_efectivo
                or producto.tipo != TipoProducto.PLATO
            ):
                raise BusinessRuleError(
                    "El menú acordado solo puede tener platos disponibles",
                    "MENU_ACORDADO_INVALIDO",
                )
            if item.cantidad <= 0 or item.precio_acordado <= Decimal(0):
                raise BusinessRuleError(
                    f"{producto.nombre}: la cantidad y el precio acordado tienen "
                    "que ser mayores a 0",
                    "MENU_ACORDADO_INVALIDO",
                )
            detalles.append(
                DetalleMenuAcordado(
                    producto_id=producto.id,
                    cantidad=item.cantidad,
                    precio=item.precio_acordado,
                )
            )
        return detalles

    @staticmethod
    def _a_salida(reserva: Reserva) -> ReservaOut:
        sena = reserva.sena
        menu = reserva.menu_acordado
        return ReservaOut(
            id=reserva.id,
            nro_reserva=reserva.id,
            fecha_hora=reserva.fecha_hora,
            fecha=reserva.fecha_hora.date(),
            hora=reserva.fecha_hora.time(),
            duracion_horas=reserva.duracion_horas,
            cantidad_comensales=reserva.cantidad_comensales,
            estado=reserva.estado,
            cliente=(
                ClienteResumen.model_validate(reserva.cliente)
                if reserva.cliente
                else None
            ),
            mesas=[
                MesaResumen.model_validate(m)
                for m in sorted(reserva.mesas, key=lambda m: m.numero)
            ],
            sena=(
                SenaOut(
                    monto=sena.monto,
                    fecha=sena.fecha,
                    medio_pago_id=sena.medio_pago_id,
                    medio_pago_nombre=sena.medio_pago.nombre,
                    devuelta=sena.devuelta,
                )
                if sena
                else None
            ),
            menu_acordado=[
                ItemMenuOut(
                    producto_id=d.producto_id,
                    producto_nombre=d.producto.nombre,
                    cantidad=d.cantidad,
                    precio=d.precio,
                )
                for d in (menu.detalles if menu else [])
            ],
            fecha_hora_llegada=reserva.fecha_hora_llegada,
            tiene_comanda=reserva.comanda is not None,
        )
