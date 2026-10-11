"""Comanda y DetalleComanda (mínimo). Los completan HU-05a a HU-05f y HU-06.

`DetalleComanda.precio_unitario` guarda el precio del producto al momento de
cargarlo, para que un cambio de precio no afecte comandas abiertas (HU-04a CA5).
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import EstadoComanda
from app.models.carta import Producto
from app.models.personal import Mozo
from app.models.salon import Mesa


class Comanda(Base):
    __tablename__ = "comanda"

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha_hora: Mapped[datetime] = mapped_column(default=datetime.now)
    mesa_id: Mapped[int] = mapped_column(ForeignKey("mesa.id"))
    mozo_id: Mapped[int] = mapped_column(ForeignKey("mozo.id"))
    estado: Mapped[EstadoComanda] = mapped_column(
        Enum(EstadoComanda, native_enum=False, length=20),
        default=EstadoComanda.ABIERTA,
    )

    mesa: Mapped[Mesa] = relationship()
    mozo: Mapped[Mozo] = relationship()
    detalles: Mapped[list["DetalleComanda"]] = relationship(
        back_populates="comanda", cascade="all, delete-orphan"
    )


class DetalleComanda(Base):
    __tablename__ = "detalle_comanda"

    id: Mapped[int] = mapped_column(primary_key=True)
    comanda_id: Mapped[int] = mapped_column(ForeignKey("comanda.id"))
    producto_id: Mapped[int] = mapped_column(ForeignKey("producto.id"))
    cantidad: Mapped[int] = mapped_column(default=1)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    comanda: Mapped[Comanda] = relationship(back_populates="detalles")
    producto: Mapped[Producto] = relationship()
