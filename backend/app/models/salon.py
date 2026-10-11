"""Sector y Mesa (mínimo). Los completan HU-01a y HU-01b."""

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Sector(Base):
    __tablename__ = "sector"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50))
    activo: Mapped[bool] = mapped_column(default=True)

    mesas: Mapped[list["Mesa"]] = relationship(back_populates="sector")


class Mesa(Base):
    __tablename__ = "mesa"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[int]
    capacidad: Mapped[int]
    sector_id: Mapped[int] = mapped_column(ForeignKey("sector.id"))
    activo: Mapped[bool] = mapped_column(default=True)

    sector: Mapped[Sector] = relationship(back_populates="mesas")
