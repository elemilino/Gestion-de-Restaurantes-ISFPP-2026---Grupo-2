# Comanda y DetalleComanda (mínimo). Los completan HU-05a a HU-05f y HU-06

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Column,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import EstadoComanda
from app.models.carta import Producto
from app.models.personal import Mozo
from app.models.salon import Mesa

if TYPE_CHECKING:
    from app.models.facturacion import Factura
    from app.models.reservas import Reserva

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
    estado: Mapped[EstadoComanda] = mapped_column(
        Enum(EstadoComanda, native_enum=False, length=20),
        default=EstadoComanda.ABIERTA,
    )
    motivo_anulacion: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None
    )
    # HU-05a CA8: comanda abierta a partir de una reserva cumplida.
    reserva_id: Mapped[int | None] = mapped_column(
        ForeignKey("reserva.id"), unique=True, default=None
    )

    mozo: Mapped[Mozo] = relationship()
    mesas: Mapped[list[Mesa]] = relationship(secondary=comanda_mesa)
    detalles: Mapped[list["DetalleComanda"]] = relationship(
        back_populates="comanda", cascade="all, delete-orphan"
    )
    # HU-08a: una comanda tiene a lo sumo una factura. Se usa para bloquear la
    # reapertura y la modificación de una comanda con factura (HU-05b, HU-05d).
    factura: Mapped["Factura | None"] = relationship(
        back_populates="comanda", uselist=False
    )
    reserva: Mapped["Reserva | None"] = relationship(back_populates="comanda")

    @property
    def abierta(self) -> bool:
        return self.estado == EstadoComanda.ABIERTA


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
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    entregado: Mapped[bool] = mapped_column(default=False)

    comanda: Mapped[Comanda] = relationship(back_populates="detalles")
    producto: Mapped[Producto] = relationship()
