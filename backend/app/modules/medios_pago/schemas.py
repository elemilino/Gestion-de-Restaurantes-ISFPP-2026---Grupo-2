"""Contratos Pydantic de entrada y salida para medios de pago (HU-07a, HU-07b)."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import TipoAcreditacion


class MedioPagoBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(min_length=1, max_length=50)
    tipo_acreditacion: TipoAcreditacion
    porcentaje_recargo: Decimal = Field(
        default=Decimal("0.00"), ge=0, max_digits=5, decimal_places=2
    )


class MedioPagoCreate(MedioPagoBase):
    pass


class MedioPagoUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(min_length=1, max_length=50)
    tipo_acreditacion: TipoAcreditacion
    porcentaje_recargo: Decimal = Field(max_digits=5, decimal_places=2)
    activo: bool | None = None


class MedioPagoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    tipo_acreditacion: TipoAcreditacion
    porcentaje_recargo: Decimal
    activo: bool
