"""Mozo (mínimo). Lo completa HU-02 (teléfono, turno, sector, vínculo con Usuario)."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Mozo(Base):
    __tablename__ = "mozo"

    id: Mapped[int] = mapped_column(primary_key=True)
    dni: Mapped[str] = mapped_column(String(8), unique=True)
    nombre: Mapped[str] = mapped_column(String(50))
    apellido: Mapped[str] = mapped_column(String(50))
    activo: Mapped[bool] = mapped_column(default=True)
