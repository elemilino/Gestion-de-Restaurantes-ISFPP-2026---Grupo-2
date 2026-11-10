"""Promocion y promocion_producto (HU-09a).

Una promoción aplica un mismo porcentaje de descuento a uno o más productos
(relación N:M). La baja es lógica (`activo = False`) para no perder el historial.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Numeric,
    String,
    Table,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.carta import Producto

promocion_producto = Table(
    "promocion_producto",
    Base.metadata,
    Column("promocion_id", ForeignKey("promocion.id"), primary_key=True),
    Column("producto_id", ForeignKey("producto.id"), primary_key=True),
)


class Promocion(Base):
    __tablename__ = "promocion"
    __table_args__ = (
        CheckConstraint(
            "descuento > 0 AND descuento <= 100", name="ck_promocion_descuento"
        ),
        CheckConstraint("fecha_fin > fecha_inicio", name="ck_promocion_fechas"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(200))
    fecha_inicio: Mapped[date] = mapped_column(Date)
    fecha_fin: Mapped[date] = mapped_column(Date)
    descuento: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    activo: Mapped[bool] = mapped_column(default=True)

    productos: Mapped[list[Producto]] = relationship(secondary=promocion_producto)

    @property
    def vigente(self) -> bool:
        """Activa y dentro del rango de fechas (HU-09a CA5)."""
        hoy = date.today()
        return self.activo and self.fecha_inicio <= hoy <= self.fecha_fin
