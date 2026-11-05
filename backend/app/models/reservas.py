"""Reserva (mínimo). La completa HU-11a.

Por ahora tiene solo lo que necesita HU-01b para bloquear cambios en las mesas
(CA5 y CA7): las mesas reservadas, la fecha, los comensales y el estado.
Una reserva puede ocupar varias mesas (relación N:M con `reserva_mesa`).
"""

from datetime import datetime

from sqlalchemy import Column, Enum, ForeignKey, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import EstadoReserva
from app.models.salon import Mesa

reserva_mesa = Table(
    "reserva_mesa",
    Base.metadata,
    Column("reserva_id", ForeignKey("reserva.id"), primary_key=True),
    Column("mesa_id", ForeignKey("mesa.id"), primary_key=True),
)


class Reserva(Base):
    __tablename__ = "reserva"

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha_hora: Mapped[datetime]
    cantidad_comensales: Mapped[int]
    estado: Mapped[EstadoReserva] = mapped_column(
        Enum(EstadoReserva, native_enum=False, length=20),
        default=EstadoReserva.ACTIVA,
    )

    mesas: Mapped[list[Mesa]] = relationship(secondary=reserva_mesa)
