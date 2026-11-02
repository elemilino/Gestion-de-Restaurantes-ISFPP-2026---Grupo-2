"""Comanda y DetalleComanda (mínimo). Los completan HU-05a a HU-05f y HU-06.

`DetalleComanda.precio_unitario` guarda el precio del producto al momento de
cargarlo, para que un cambio de precio no afecte comandas abiertas (HU-04a CA5).
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, Column, ForeignKey, Table, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.carta import Producto
from app.models.personal import Mozo
from app.models.salon import Mesa

comanda_mesa = Table(
    "comanda_mesa",
    Base.metadata,
    Column("comanda_id", ForeignKey("comanda.id"), primary_key=True),
    Column("mesa_id", ForeignKey("mesa.id"), primary_key=True),
)


class Comanda(Base):
    __tablename__ = "comanda"
    __table_args__ = (
        CheckConstraint("cantidad_comensales > 0", name="ck_comanda_comensales"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    cantidad_comensales: Mapped[int]
    fecha_hora_apertura: Mapped[datetime] = mapped_column(default=datetime.now)
    fecha_hora_cierre: Mapped[datetime | None] = mapped_column(default=None)
    mozo_id: Mapped[int] = mapped_column(ForeignKey("mozo.id"))

    mozo: Mapped[Mozo] = relationship()
    mesas: Mapped[list[Mesa]] = relationship(secondary=comanda_mesa)
    detalles: Mapped[list["DetalleComanda"]] = relationship(
        back_populates="comanda", cascade="all, delete-orphan"
    )

    @property
    def abierta(self) -> bool:
        return self.fecha_hora_cierre is None


class DetalleComanda(Base):
    __tablename__ = "detalle_comanda"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_detalle_cantidad"),
        UniqueConstraint(
            "comanda_id", "producto_id", name="uq_detalle_comanda_producto"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    comanda_id: Mapped[int] = mapped_column(ForeignKey("comanda.id"))
    producto_id: Mapped[int] = mapped_column(ForeignKey("producto.id"))
    cantidad: Mapped[int] = mapped_column(default=1)
    entregado: Mapped[bool] = mapped_column(default=False)

    comanda: Mapped[Comanda] = relationship(back_populates="detalles")
    producto: Mapped[Producto] = relationship()
