"""Mozo. Completado por HU-02 (teléfono, sector, vínculo con Usuario)."""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.salon import Sector
    from app.models.usuario import Usuario


class Mozo(Base):
    __tablename__ = "mozo"

    id: Mapped[int] = mapped_column(primary_key=True)
    dni: Mapped[str] = mapped_column(String(8), unique=True)
    nombre: Mapped[str] = mapped_column(String(50))
    apellido: Mapped[str] = mapped_column(String(50))
    telefono: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sector_id: Mapped[int | None] = mapped_column(
        ForeignKey("sector.id"), nullable=True
    )
    usuario_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuario.id"), unique=True, nullable=True
    )
    activo: Mapped[bool] = mapped_column(default=True)

    sector: Mapped["Sector | None"] = relationship(foreign_keys=[sector_id])
    usuario: Mapped["Usuario | None"] = relationship(
        back_populates="mozo", foreign_keys=[usuario_id]
    )
