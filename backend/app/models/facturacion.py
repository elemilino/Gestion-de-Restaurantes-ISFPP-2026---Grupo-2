"""Modelos para Facturación y Detalle de Pagos (HU-08a, HU-08b)."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import EstadoFactura, TipoFactura

if TYPE_CHECKING:
    from app.models.comandas import Comanda
    from app.models.medios_pago import MedioPago


class Factura(Base):
    __tablename__ = "factura"

    id: Mapped[int] = mapped_column(primary_key=True)
    comanda_id: Mapped[int] = mapped_column(ForeignKey("comanda.id"), unique=True)
    cuit_dni_cliente: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tipo_factura: Mapped[TipoFactura] = mapped_column(
        Enum(TipoFactura, native_enum=False, length=30),
        default=TipoFactura.CONSUMIDOR_FINAL,
    )
    fecha: Mapped[datetime] = mapped_column(default=datetime.now)
    importe_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total_a_pagar: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    monto_recibido: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00")
    )
    estado: Mapped[EstadoFactura] = mapped_column(
        Enum(EstadoFactura, native_enum=False, length=20),
        default=EstadoFactura.ADEUDADA,
    )

    comanda: Mapped["Comanda"] = relationship(back_populates="factura")
    detalles_pago: Mapped[list["DetallePago"]] = relationship(
        back_populates="factura", cascade="all, delete-orphan"
    )


class DetallePago(Base):
    __tablename__ = "detalle_pago"

    id: Mapped[int] = mapped_column(primary_key=True)
    factura_id: Mapped[int] = mapped_column(ForeignKey("factura.id"))
    medio_pago_id: Mapped[int] = mapped_column(ForeignKey("medio_pago.id"))
    monto_abonado: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    monto_con_recargo: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    factura: Mapped["Factura"] = relationship(back_populates="detalles_pago")
    medio_pago: Mapped["MedioPago"] = relationship()
