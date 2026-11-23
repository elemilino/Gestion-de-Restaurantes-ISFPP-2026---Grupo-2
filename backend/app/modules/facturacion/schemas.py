"""Contratos Pydantic de entrada y salida para facturación y cobros (HU-08a, HU-08b)."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import EstadoFactura, TipoFactura


class FacturaCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    comanda_id: int
    tipo_factura: TipoFactura = TipoFactura.CONSUMIDOR_FINAL
    cuit_dni_cliente: str | None = Field(default=None, max_length=20)


class DetallePagoCreate(BaseModel):
    medio_pago_id: int
    monto_abonado: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class CobroCreate(BaseModel):
    pagos: list[DetallePagoCreate] = Field(min_length=1)
    monto_recibido: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=2
    )


class DetallePagoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    medio_pago_id: int
    medio_pago_nombre: str
    porcentaje_recargo: Decimal
    monto_abonado: Decimal
    monto_con_recargo: Decimal


class FacturaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    comanda_id: int
    cuit_dni_cliente: str | None
    tipo_factura: TipoFactura
    fecha: datetime
    importe_total: Decimal
    descuento_sena: Decimal
    total_a_pagar: Decimal
    monto_recibido: Decimal
    estado: EstadoFactura
    detalles_pago: list[DetallePagoOut] = []


class ItemComprobante(BaseModel):
    producto_nombre: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal


class ComprobanteOut(BaseModel):
    factura_id: int
    fecha: datetime
    tipo_factura: TipoFactura
    cuit_dni_cliente: str | None
    comanda_id: int
    mesa_numero: int | None
    mozo_nombre: str | None
    items: list[ItemComprobante]
    importe_total: Decimal
    descuento_sena: Decimal
    total_a_pagar: Decimal
    monto_recibido: Decimal
    vuelto: Decimal
    detalles_pago: list[DetallePagoOut]


class ComandaPorFacturar(BaseModel):
    """Comanda cerrada que todavía no tiene factura (pantalla de caja)."""

    comanda_id: int
    fecha_hora_cierre: datetime | None
    mesas: list[int]
    mozo: str
    cantidad_comensales: int
    importe: Decimal
