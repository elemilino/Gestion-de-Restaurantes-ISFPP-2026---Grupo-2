"""Modelo para Medios de Pago (HU-07a, HU-07b)."""

from decimal import Decimal

from sqlalchemy import Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.enums import TipoAcreditacion


class MedioPago(Base):
    __tablename__ = "medio_pago"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50))
    tipo_acreditacion: Mapped[TipoAcreditacion] = mapped_column(
        Enum(TipoAcreditacion, native_enum=False, length=20)
    )
    porcentaje_recargo: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.00")
    )
    activo: Mapped[bool] = mapped_column(default=True)
