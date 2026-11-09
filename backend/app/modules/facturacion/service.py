"""Reglas de negocio del módulo facturacion (HU-08a, HU-08b)."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.enums import EstadoComanda, EstadoFactura
from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.facturacion import DetallePago, Factura
from app.modules.facturacion.repository import FacturacionRepository
from app.modules.facturacion.schemas import (
    CobroCreate,
    ComprobanteOut,
    DetallePagoOut,
    FacturaCreate,
    FacturaOut,
    ItemComprobante,
)


class FacturacionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = FacturacionRepository(db)

    def listar_facturas(self) -> list[FacturaOut]:
        facturas = self.repo.listar_facturas()
        return [self._a_factura_out(f) for f in facturas]

    def obtener_factura(self, factura_id: int) -> FacturaOut:
        factura = self._obtener_entidad_factura(factura_id)
        return self._a_factura_out(factura)

    def generar_factura(self, datos: FacturaCreate) -> FacturaOut:
        comanda = self.repo.buscar_comanda(datos.comanda_id)
        if not comanda:
            raise NotFoundError(
                "La comanda no existe",
                code="COMANDA_NO_ENCONTRADA",
            )

        # HU-08a CA3: Comanda abierta
        if comanda.estado != EstadoComanda.CERRADA:
            raise BusinessRuleError(
                "No se puede generar una factura de una comanda que no esté cerrada",
                code="COMANDA_NO_CERRADA",
            )

        # HU-08a CA2: Comanda vacía o sin consumos
        if not comanda.detalles or sum(d.cantidad for d in comanda.detalles) == 0:
            raise BusinessRuleError(
                "No se puede generar una factura de una comanda sin consumos",
                code="COMANDA_SIN_CONSUMOS",
            )

        # Verificar si ya existe factura para esta comanda
        if self.repo.buscar_factura_por_comanda_id(datos.comanda_id):
            raise ConflictError(
                "Ya existe una factura para esta comanda",
                code="FACTURA_YA_GENERADA",
            )

        # HU-08a CA1: Calcular subtotal de consumos
        subtotal = sum(
            (Decimal(str(d.precio_unitario)) * d.cantidad) for d in comanda.detalles
        )

        factura = Factura(
            comanda_id=comanda.id,
            cuit_dni_cliente=datos.cuit_dni_cliente,
            tipo_factura=datos.tipo_factura,
            importe_total=subtotal,
            total_a_pagar=subtotal,
            monto_recibido=Decimal("0.00"),
            estado=EstadoFactura.ADEUDADA,
        )
        self.db.add(factura)
        self.db.commit()

        # Recargar con relaciones
        factura_cargada = self._obtener_entidad_factura(factura.id)
        return self._a_factura_out(factura_cargada)

    def cobrar_factura(self, factura_id: int, datos: CobroCreate) -> FacturaOut:
        factura = self._obtener_entidad_factura(factura_id)

        # HU-08b CA5: Factura ya pagada
        if factura.estado == EstadoFactura.PAGADA:
            raise ConflictError(
                "La factura ya fue saldada",
                code="FACTURA_YA_PAGADA",
            )

        # Validar y preparar los detalles de pago
        detalles_pago: list[DetallePago] = []
        suma_abonada = Decimal("0.00")

        for pago_in in datos.pagos:
            medio = self.repo.buscar_medio_pago(pago_in.medio_pago_id)
            if not medio:
                raise NotFoundError(
                    f"El medio de pago #{pago_in.medio_pago_id} no existe",
                    code="MEDIO_PAGO_NO_ENCONTRADO",
                )

            # HU-08b CA1/CA2/CA3: solo medios activos
            if not medio.activo:
                raise BusinessRuleError(
                    f"El medio de pago '{medio.nombre}' no se encuentra habilitado",
                    code="MEDIO_PAGO_INACTIVO",
                )

            monto_abonado = pago_in.monto_abonado
            suma_abonada += monto_abonado

            # Cálculo de recargo
            recargo = (monto_abonado * medio.porcentaje_recargo) / Decimal("100")
            monto_con_recargo = (monto_abonado + recargo).quantize(Decimal("0.01"))

            detalle = DetallePago(
                factura_id=factura.id,
                medio_pago_id=medio.id,
                monto_abonado=monto_abonado,
                monto_con_recargo=monto_con_recargo,
            )
            detalles_pago.append(detalle)

        # HU-08b CA3 & CA4: Validar que los montos abonados cubran el total
        if suma_abonada < factura.importe_total:
            raise BusinessRuleError(
                "El monto abonado es insuficiente para cubrir el importe total",
                code="PAGO_INSUFICIENTE",
            )
        if suma_abonada > factura.importe_total:
            raise BusinessRuleError(
                "El monto abonado supera el importe total de la factura",
                code="PAGO_EXCEDIDO",
            )

        # HU-08b CA4: Calcular total a pagar sumando montos con recargo
        total_a_pagar = sum(dp.monto_con_recargo for dp in detalles_pago)

        # Validar monto recibido (efectivo/cobro real)
        monto_recibido = (
            datos.monto_recibido if datos.monto_recibido is not None else total_a_pagar
        )
        if monto_recibido < total_a_pagar:
            raise BusinessRuleError(
                "El monto recibido no puede ser inferior al total a pagar",
                code="MONTO_RECIBIDO_INSUFICIENTE",
            )

        # Guardar detalles y actualizar factura
        factura.detalles_pago = detalles_pago
        factura.total_a_pagar = total_a_pagar
        factura.monto_recibido = monto_recibido
        factura.estado = EstadoFactura.PAGADA

        # Cerrar ciclo de comanda marcándola como FACTURADA
        if factura.comanda:
            factura.comanda.estado = EstadoComanda.FACTURADA

        self.db.commit()

        factura_actualizada = self._obtener_entidad_factura(factura.id)
        return self._a_factura_out(factura_actualizada)

    def obtener_comprobante(self, factura_id: int) -> ComprobanteOut:
        """HU-08b: Genera el comprobante de pago descargable."""
        factura = self._obtener_entidad_factura(factura_id)
        if factura.estado != EstadoFactura.PAGADA:
            raise BusinessRuleError(
                "Solo se puede generar comprobante de una factura pagada",
                code="FACTURA_NO_PAGADA",
            )

        comanda = factura.comanda
        mesa_numero = comanda.mesas[0].numero if (comanda and comanda.mesas) else None
        mozo_nombre = (
            f"{comanda.mozo.nombre} {comanda.mozo.apellido}"
            if (comanda and comanda.mozo)
            else None
        )

        items: list[ItemComprobante] = []
        if comanda and comanda.detalles:
            for d in comanda.detalles:
                sub = (Decimal(str(d.precio_unitario)) * d.cantidad).quantize(
                    Decimal("0.01")
                )
                items.append(
                    ItemComprobante(
                        producto_nombre=(
                            d.producto.nombre
                            if d.producto
                            else f"Producto #{d.producto_id}"
                        ),
                        cantidad=d.cantidad,
                        precio_unitario=Decimal(str(d.precio_unitario)),
                        subtotal=sub,
                    )
                )

        vuelto = max(Decimal("0.00"), factura.monto_recibido - factura.total_a_pagar)

        return ComprobanteOut(
            factura_id=factura.id,
            fecha=factura.fecha,
            tipo_factura=factura.tipo_factura,
            cuit_dni_cliente=factura.cuit_dni_cliente,
            comanda_id=factura.comanda_id,
            mesa_numero=mesa_numero,
            mozo_nombre=mozo_nombre,
            items=items,
            importe_total=factura.importe_total,
            total_a_pagar=factura.total_a_pagar,
            monto_recibido=factura.monto_recibido,
            vuelto=vuelto,
            detalles_pago=[
                self._a_detalle_pago_out(dp) for dp in factura.detalles_pago
            ],
        )

    def _obtener_entidad_factura(self, factura_id: int) -> Factura:
        factura = self.repo.buscar_factura_por_id(factura_id)
        if not factura:
            raise NotFoundError(
                "La factura no existe",
                code="FACTURA_NO_ENCONTRADA",
            )
        return factura

    def _a_factura_out(self, f: Factura) -> FacturaOut:
        return FacturaOut(
            id=f.id,
            comanda_id=f.comanda_id,
            cuit_dni_cliente=f.cuit_dni_cliente,
            tipo_factura=f.tipo_factura,
            fecha=f.fecha,
            importe_total=f.importe_total,
            total_a_pagar=f.total_a_pagar,
            monto_recibido=f.monto_recibido,
            estado=f.estado,
            detalles_pago=[self._a_detalle_pago_out(dp) for dp in f.detalles_pago],
        )

    def _a_detalle_pago_out(self, dp: DetallePago) -> DetallePagoOut:
        medio_nombre = (
            dp.medio_pago.nombre if dp.medio_pago else f"Medio #{dp.medio_pago_id}"
        )
        recargo = dp.medio_pago.porcentaje_recargo if dp.medio_pago else Decimal("0.00")
        return DetallePagoOut(
            id=dp.id,
            medio_pago_id=dp.medio_pago_id,
            medio_pago_nombre=medio_nombre,
            porcentaje_recargo=recargo,
            monto_abonado=dp.monto_abonado,
            monto_con_recargo=dp.monto_con_recargo,
        )
