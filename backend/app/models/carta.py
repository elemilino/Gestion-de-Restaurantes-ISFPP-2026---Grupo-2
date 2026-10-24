"""SeccionCarta y Producto (HU-03a y HU-04a a HU-04d).

Producto es una sola tabla con la columna `tipo` (PLATO, POSTRE, BEBIDA). Las
columnas propias de cada tipo aceptan vacío (decisión C5 del módulo carta).
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
    nombre: Mapped[str] = mapped_column(String(60))
    descripcion: Mapped[str | None] = mapped_column(String(200))
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    tipo: Mapped[TipoProducto] = mapped_column(
        Enum(TipoProducto, native_enum=False, length=20)
    )
    seccion_id: Mapped[int] = mapped_column(ForeignKey("seccion_carta.id"))
    # Plato y postre (opcional).
    porcion_gramos: Mapped[int | None]
    # Bebida (obligatorios en bebidas, vacíos en plato y postre).
    volumen_ml: Mapped[int | None]
    alcoholica: Mapped[bool | None]
    # Marca manual y stock opcional (None = no se controla). Lógica en HU-04d.
    disponible: Mapped[bool] = mapped_column(default=True)
    stock: Mapped[int | None]
    activo: Mapped[bool] = mapped_column(default=True)

    seccion: Mapped[SeccionCarta] = relationship(back_populates="productos")

    @property
    def disponible_efectivo(self) -> bool:
        """Lo que ve el mozo: activo, marcado disponible y con stock si lo controla."""
        return (
            self.activo and self.disponible and (self.stock is None or self.stock > 0)
        )
