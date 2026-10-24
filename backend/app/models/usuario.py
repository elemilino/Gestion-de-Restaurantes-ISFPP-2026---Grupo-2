from typing import TYPE_CHECKING
from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import Rol

if TYPE_CHECKING:
    from app.models.personal import Mozo


class Usuario(Base):
    """Usuario que inicia sesión. Vinculado opcionalmente con Mozo (HU-02)."""

    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    nombre: Mapped[str] = mapped_column(String(100))
    rol: Mapped[Rol] = mapped_column(Enum(Rol, native_enum=False, length=30))
    activo: Mapped[bool] = mapped_column(default=True)

    mozo: Mapped["Mozo | None"] = relationship(back_populates="usuario", uselist=False)
