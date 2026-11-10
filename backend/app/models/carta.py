"""SeccionCarta y Producto (HU-03a, HU-04a a HU-04d y HU-09b).

Producto es una sola tabla con la columna `tipo` (PLATO, POSTRE, BEBIDA y los
menús MENU_EJECUTIVO y MENU_DEL_DIA). Las columnas propias de cada tipo aceptan
vacío (decisión C5 del módulo carta).
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import TIPOS_MENU, TipoProducto


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
    # Menús (HU-09b): vigencia y componentes. El ejecutivo es plato + postre
    # (no incluye bebida); el del día, un plato.
    fecha_inicio: Mapped[date | None]
    fecha_fin: Mapped[date | None]
    plato_id: Mapped[int | None] = mapped_column(ForeignKey("producto.id"))
    postre_id: Mapped[int | None] = mapped_column(ForeignKey("producto.id"))

    seccion: Mapped[SeccionCarta] = relationship(back_populates="productos")
    plato: Mapped["Producto | None"] = relationship(
        foreign_keys="Producto.plato_id", remote_side="Producto.id"
    )
    postre: Mapped["Producto | None"] = relationship(
        foreign_keys="Producto.postre_id", remote_side="Producto.id"
    )

    @property
    def es_menu(self) -> bool:
        return self.tipo in TIPOS_MENU

    @property
    def vigente(self) -> bool:
        """Un menú se ofrece solo entre su fecha de inicio y de fin (HU-09b)."""
        if not self.es_menu:
            return True
        return self.fecha_inicio <= date.today() <= self.fecha_fin

    @property
    def disponible_efectivo(self) -> bool:
        """Lo que ve el mozo: activo, marcado disponible, con stock si lo controla
        y, si es un menú, vigente."""
        return (
            self.activo
            and self.disponible
            and (self.stock is None or self.stock > 0)
            and self.vigente
        )
