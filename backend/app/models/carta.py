"""SeccionCarta y Producto (mínimo). Los completan HU-03a y HU-04a a HU-04d.

Producto es una sola tabla con la columna `tipo` (PLATO, POSTRE, BEBIDA). Los datos
propios de cada tipo (gramos, volumen, alcohólica) y la disponibilidad/stock los
agrega HU-04.
"""

from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import TipoProducto


class SeccionCarta(Base):
    __tablename__ = "seccion_carta"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50))
    orden: Mapped[int] = mapped_column(default=1)
    activo: Mapped[bool] = mapped_column(default=True)

    productos: Mapped[list["Producto"]] = relationship(back_populates="seccion")


class Producto(Base):
    __tablename__ = "producto"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50))
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    tipo: Mapped[TipoProducto] = mapped_column(
        Enum(TipoProducto, native_enum=False, length=20)
    )
    seccion_id: Mapped[int] = mapped_column(ForeignKey("seccion_carta.id"))
    activo: Mapped[bool] = mapped_column(default=True)

    seccion: Mapped[SeccionCarta] = relationship(back_populates="productos")
