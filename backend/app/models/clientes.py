"""Cliente de la base de clientes (HU-10)."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Cliente(Base):
    """Datos de contacto e identificación de un cliente.

    La baja es lógica (`activo = False`). La API expone `eliminado` como el
    complemento, para respetar el contrato de HU-10.

    El DNI se valida como único entre clientes activos en el service, no con
    una restricción de la base: así se puede volver a registrar el DNI de un
    cliente dado de baja.
    """

    __tablename__ = "cliente"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50))
    apellido: Mapped[str] = mapped_column(String(50))
    telefono: Mapped[str] = mapped_column(String(20))
    dni: Mapped[str] = mapped_column(String(8), index=True)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    activo: Mapped[bool] = mapped_column(default=True)

    @property
    def eliminado(self) -> bool:
        return not self.activo
