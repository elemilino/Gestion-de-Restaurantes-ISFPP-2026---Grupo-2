from sqlalchemy.orm import Session
from datetime import datetime

from app.core.enums import EstadoComanda
from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.comandas import Comanda, DetalleComanda
from app.models.personal import Mozo
from app.models.carta import Producto
from app.models.salon import Mesa
from app.modules.carta.service import ProductoService
from app.modules.comandas.repository import ComandaRepository
from app.modules.comandas.schemas import (
    ComandaAnular,
    ComandaCrear,
    ComandaModificar,
    ComandaRespuesta,
    DetalleAgregar,
    ComandaFiltros,
    MesaTableroOut,
)


class ComandaService:
    def __init__(self, db: Session):
        self.db = db
        self.comandas = ComandaRepository(db)
        # HU-04d: disponibilidad y stock los maneja el módulo carta.
        self.carta = ProductoService(db)

    # ---------- HU-05a ----------
    def crear(self, datos: ComandaCrear) -> Comanda:
        """HU-05a: crea una comanda abierta para un mozo y una o más mesas."""
        mozo = self._validar_mozo(datos.dni_mozo)
        mesas = self._validar_mesas(datos.numeros_mesa)
        self._validar_sector(mesas, mozo)
        self._validar_capacidad(datos.cantidad_comensales, mesas)

        ocupadas = self.comandas.numeros_de_mesas_ocupadas(mesas)
        if ocupadas:
            raise ConflictError(
                f"Las mesas {ocupadas} se encuentran ocupadas", "MESA_OCUPADA"
            )

        comanda = Comanda(
            cantidad_comensales=datos.cantidad_comensales, mozo=mozo, mesas=mesas
        )
        return self.comandas.guardar(comanda)

    # ---------- HU-05b ----------
    def modificar(self, comanda_id: int, datos: ComandaModificar) -> Comanda:
        """HU-05b: cambia el mozo y/o la cantidad de comensales."""
        comanda = self._comanda_modificable(comanda_id)

        # Primero se valida todo y recién después se asigna: si algo falla,
        # la comanda no queda a medio modificar.
        nuevo_mozo = None
        if datos.dni_mozo is not None:
            nuevo_mozo = self._validar_mozo(datos.dni_mozo)
            self._validar_sector(comanda.mesas, nuevo_mozo)
        if datos.cantidad_comensales is not None:
            self._validar_capacidad(datos.cantidad_comensales, comanda.mesas)

        if nuevo_mozo is not None:
            comanda.mozo = nuevo_mozo
        if datos.cantidad_comensales is not None:
            comanda.cantidad_comensales = datos.cantidad_comensales
        return self.comandas.guardar(comanda)

    def agregar_producto(self, comanda_id: int, datos: DetalleAgregar) -> Comanda:
        """HU-05b CA1/CA2/CA7: agrega un producto o suma a uno ya cargado."""
        comanda = self._comanda_modificable(comanda_id)

        producto = self.comandas.buscar_producto(datos.producto_id)
        if producto is None or not producto.activo:
            raise BusinessRuleError(
                "No es posible agregar el producto: no existe o está eliminado",
                "PRODUCTO_NO_DISPONIBLE",
            )
        # HU-04d CA1, CA3 y CA4: no se carga si está marcado no disponible o si
        # no alcanza el stock; si lo controla, se descuenta al cargarlo.
        self._verificar_disponible(producto)
        self.carta.descontar_stock(producto, datos.cantidad)

        existente = next(
            (d for d in comanda.detalles if d.producto_id == producto.id), None
        )
        if existente is None:
            comanda.detalles.append(
                DetalleComanda(
                    producto=producto,
                    cantidad=datos.cantidad,
                    precio_unitario=producto.precio,
                )
            )
        else:
            existente.cantidad += datos.cantidad
            existente.entregado = False  # las unidades nuevas aún no se entregaron
        return self.comandas.guardar(comanda)

    def cambiar_cantidad(
        self, comanda_id: int, detalle_id: int, cantidad: int
    ) -> Comanda:
        """HU-05b CA4/CA9/CA10: fija la cantidad de un producto de la comanda."""
        comanda = self._comanda_modificable(comanda_id)
        detalle = self._detalle(comanda, detalle_id)
        if detalle.entregado:
            if cantidad < detalle.cantidad:
                raise ConflictError(
                    "No es posible reducir la cantidad de un producto ya entregado",
                    "DETALLE_ENTREGADO",
                )
            if cantidad > detalle.cantidad:
                detalle.entregado = False  # las unidades nuevas aún no se entregaron
        # HU-04d: más unidades descuentan stock; menos unidades lo reponen.
        diferencia = cantidad - detalle.cantidad
        if diferencia > 0:
            self._verificar_disponible(detalle.producto)
            self.carta.descontar_stock(detalle.producto, diferencia)
        elif diferencia < 0:
            self.carta.reponer_stock(detalle.producto, -diferencia)
        detalle.cantidad = cantidad
        return self.comandas.guardar(comanda)

    def quitar_producto(self, comanda_id: int, detalle_id: int) -> Comanda:
        """HU-05b CA3/CA8: quita un producto de la comanda si no fue entregado."""
        comanda = self._comanda_modificable(comanda_id)
        detalle = self._detalle(comanda, detalle_id)
        if detalle.entregado:
            raise ConflictError(
                "No es posible quitar un producto que ya fue entregado",
                "DETALLE_ENTREGADO",
            )
        self.carta.reponer_stock(detalle.producto, detalle.cantidad)  # HU-04d
        comanda.detalles.remove(detalle)
        return self.comandas.guardar(comanda)

    # ---------- HU-06 ----------
    def obtener(self, comanda_id: int) -> Comanda:
        """Obtiene una comanda por su ID."""
        return self._buscar_comanda(comanda_id)

    def entregar_producto(
        self, comanda_id: int, detalle_id: int, entregado: bool = True
    ) -> Comanda:
        """HU-06: registra o actualiza la entrega en mesa de un ítem del pedido."""
        comanda = self._comanda_modificable(comanda_id)
        detalle = self._detalle(comanda, detalle_id)
        detalle.entregado = entregado
        return self.comandas.guardar(comanda)

    def anular(self, comanda_id: int, datos: ComandaAnular) -> Comanda:
        """HU-06 CA3: cancela la comanda abierta con motivo y pasa a ANULADA."""
        comanda = self._buscar_comanda(comanda_id)
        if comanda.estado == EstadoComanda.ANULADA:
            raise ConflictError("La comanda ya está anulada", "COMANDA_YA_ANULADA")
        if (
            comanda.estado == EstadoComanda.FACTURADA
            or getattr(comanda, "factura", None) is not None
        ):
            raise ConflictError(
                "No se puede anular una comanda facturada", "COMANDA_FACTURADA"
            )
        if comanda.estado != EstadoComanda.ABIERTA:
            raise ConflictError(
                "No se puede anular una comanda cerrada", "COMANDA_CERRADA"
            )
        if any(d.entregado for d in comanda.detalles):
            raise ConflictError(
                "No se puede anular una comanda con productos entregados",
                "COMANDA_CON_ENTREGAS",
            )
        self._reponer_todo(comanda)  # HU-04d: nada se entregó, vuelve al stock
        comanda.estado = EstadoComanda.ANULADA
        comanda.motivo_anulacion = datos.motivo
        comanda.fecha_hora_cierre = datetime.now()
        return self.comandas.guardar(comanda)

    def tablero_mesas(self) -> list[MesaTableroOut]:
        """HU-06: estado operativo de las mesas del salón y su comanda en curso."""
        mesas = self.comandas.listar_mesas_activas()
        ids = [m.id for m in mesas]
        reservadas = self.comandas.ids_mesas_reservadas_hoy(ids)
        en_curso = self.comandas.comandas_en_curso()

        comanda_por_mesa: dict[int, Comanda] = {}
        # Prioridad a comandas ABIERTAS sobre CERRADAS
        for c in en_curso:
            if c.estado == EstadoComanda.ABIERTA:
                for m in c.mesas:
                    comanda_por_mesa.setdefault(m.id, c)
        for c in en_curso:
            if c.estado == EstadoComanda.CERRADA:
                for m in c.mesas:
                    comanda_por_mesa.setdefault(m.id, c)

        resultado: list[MesaTableroOut] = []
        for m in mesas:
            comanda = comanda_por_mesa.get(m.id)
            if comanda is not None:
                estado_mesa = (
                    "ocupada"
                    if comanda.estado == EstadoComanda.ABIERTA
                    else "esperando_cobro"
                )
                comanda_out = ComandaRespuesta.model_validate(comanda)
            elif m.id in reservadas:
                estado_mesa = "reservada"
                comanda_out = None
            else:
                estado_mesa = "libre"
                comanda_out = None

            resultado.append(
                MesaTableroOut(
                    id=m.id,
                    numero=m.numero,
                    capacidad=m.capacidad,
                    sector_id=m.sector_id,
                    sector_nombre=m.sector.nombre,
                    estado_mesa=estado_mesa,
                    comanda=comanda_out,
                )
            )
        return resultado

        # ---------- HU-05c ----------

    def cerrar(self, comanda_id: int) -> Comanda:
        """HU-05c: cierra la comanda registrando la fecha y hora de cierre."""
        comanda = self._buscar_comanda(comanda_id)
        if comanda.estado != EstadoComanda.ABIERTA:
            raise ConflictError("La comanda ya está cerrada", "COMANDA_YA_CERRADA")
        if not comanda.detalles:
            raise BusinessRuleError(
                "No se puede cerrar una comanda sin productos", "COMANDA_SIN_PRODUCTOS"
            )
        pendientes = [d.producto.nombre for d in comanda.detalles if not d.entregado]
        if pendientes:
            raise ConflictError(
                "No se puede cerrar una comanda con productos pendientes de "
                f"entrega: {', '.join(pendientes)}",
                "PRODUCTOS_PENDIENTES",
            )
        comanda.estado = EstadoComanda.CERRADA
        comanda.fecha_hora_cierre = datetime.now()
        return self.comandas.guardar(comanda)

        # ---------- HU-05d ----------

    def reabrir(self, comanda_id: int) -> Comanda:
        """HU-05d: vuelve a abrir una comanda cerrada y no facturada."""
        comanda = self._buscar_comanda(comanda_id)
        if (
            comanda.estado == EstadoComanda.FACTURADA
            or getattr(comanda, "factura", None) is not None
        ):
            raise ConflictError(
                "No se puede reabrir una comanda facturada", "COMANDA_FACTURADA"
            )
        if comanda.estado == EstadoComanda.ANULADA:
            raise ConflictError(
                "No se puede reabrir una comanda anulada", "COMANDA_ANULADA"
            )
        if comanda.estado == EstadoComanda.ABIERTA:
            raise ConflictError("La comanda ya está abierta", "COMANDA_YA_ABIERTA")
        comanda.estado = EstadoComanda.ABIERTA
        comanda.fecha_hora_cierre = None
        return self.comandas.guardar(comanda)

        # ---------- HU-05e ----------

    def eliminar(self, comanda_id: int) -> None:
        """HU-05e: elimina físicamente una comanda abierta sin entregas."""
        comanda = self._buscar_comanda(comanda_id)
        if comanda.estado != EstadoComanda.ABIERTA:
            raise ConflictError(
                "No se puede eliminar una comanda cerrada", "COMANDA_CERRADA"
            )
        if any(d.entregado for d in comanda.detalles):
            raise ConflictError(
                "No se puede eliminar una comanda con productos entregados",
                "COMANDA_CON_ENTREGAS",
            )
        self._reponer_todo(comanda)  # HU-04d: nada se entregó, vuelve al stock
        self.comandas.eliminar(comanda)

    # ---------- validaciones compartidas ----------
    def _buscar_comanda(self, comanda_id: int) -> Comanda:
        comanda = self.comandas.buscar_comanda(comanda_id)
        if comanda is None:
            raise NotFoundError(
                f"No existe la comanda {comanda_id}", "COMANDA_INEXISTENTE"
            )
        return comanda

    def _comanda_modificable(self, comanda_id: int) -> Comanda:
        comanda = self._buscar_comanda(comanda_id)
        if (
            comanda.estado == EstadoComanda.FACTURADA
            or getattr(comanda, "factura", None) is not None
        ):
            raise ConflictError(
                "No es posible modificar una comanda facturada", "COMANDA_FACTURADA"
            )
        if comanda.estado == EstadoComanda.ANULADA:
            raise ConflictError(
                "No es posible modificar una comanda anulada", "COMANDA_ANULADA"
            )
        if comanda.estado != EstadoComanda.ABIERTA:
            raise ConflictError(
                "No es posible modificar una comanda cerrada", "COMANDA_CERRADA"
            )
        return comanda

    #

    @staticmethod
    def _verificar_disponible(producto: Producto) -> None:
        """HU-04d CA1: un producto marcado no disponible no se puede cargar."""
        if not producto.disponible:
            raise BusinessRuleError(
                f"{producto.nombre} no está disponible", "PRODUCTO_NO_DISPONIBLE"
            )

    def _reponer_todo(self, comanda: Comanda) -> None:
        for detalle in comanda.detalles:
            self.carta.reponer_stock(detalle.producto, detalle.cantidad)

    @staticmethod
    def _detalle(comanda: Comanda, detalle_id: int) -> DetalleComanda:
        detalle = next((d for d in comanda.detalles if d.id == detalle_id), None)
        if detalle is None:
            raise NotFoundError(
                f"La comanda no tiene el detalle {detalle_id}", "DETALLE_INEXISTENTE"
            )
        return detalle

    def _validar_mozo(self, dni: str) -> Mozo:
        mozo = self.comandas.buscar_mozo_por_dni(dni)
        if mozo is None:
            raise BusinessRuleError(
                f"No existe un mozo con DNI {dni}", "MOZO_INEXISTENTE"
            )
        if not mozo.activo:
            raise BusinessRuleError(
                f"El mozo con DNI {dni} está eliminado", "MOZO_ELIMINADO"
            )
        return mozo

    def _validar_mesas(self, numeros: list[int]) -> list[Mesa]:
        mesas = [m for m in self.comandas.buscar_mesas_por_numeros(numeros) if m.activo]
        faltantes = sorted(set(numeros) - {m.numero for m in mesas})
        if faltantes:
            raise BusinessRuleError(
                f"Las mesas {faltantes} no existen o están eliminadas",
                "MESA_INEXISTENTE",
            )
        return mesas

    @staticmethod
    def _validar_sector(mesas: list[Mesa], mozo: Mozo) -> None:
        #
        ajenas = sorted(m.numero for m in mesas if m.sector_id != mozo.sector_id)
        if ajenas:
            raise BusinessRuleError(
                f"Las mesas {ajenas} no están asignadas al mozo",
                "MESA_FUERA_DE_SECTOR",
            )

    @staticmethod
    def _validar_capacidad(comensales: int, mesas: list[Mesa]) -> None:
        capacidad_total = sum(m.capacidad for m in mesas)
        if comensales > capacidad_total:
            raise BusinessRuleError(
                f"La cantidad de comensales ({comensales}) supera la cantidad "
                f"de sillas de las mesas ({capacidad_total})",
                "COMENSALES_SUPERAN_SILLAS",
            )

        # ---------- HU-05f ----------

    def listar(self, filtros: ComandaFiltros) -> list[Comanda]:
        """HU-05f: lista comandas según los filtros recibidos."""
        if (
            filtros.fecha_desde
            and filtros.fecha_hasta
            and filtros.fecha_desde > filtros.fecha_hasta
        ):
            raise BusinessRuleError(
                "La fecha desde no puede ser posterior a la fecha hasta",
                "RANGO_FECHAS_INVALIDO",
            )
        mozo_id = None
        if filtros.dni_mozo is not None:
            mozo = self.comandas.buscar_mozo_por_dni(filtros.dni_mozo)
            if mozo is None or not mozo.activo:
                raise BusinessRuleError(
                    f"El mozo con DNI {filtros.dni_mozo} no existe o está eliminado",
                    "MOZO_INEXISTENTE_O_ELIMINADO",
                )
            mozo_id = mozo.id
        return self.comandas.listar(
            mozo_id, filtros.fecha_desde, filtros.fecha_hasta, filtros.abierta
        )
