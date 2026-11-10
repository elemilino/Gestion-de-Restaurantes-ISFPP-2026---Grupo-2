"""Contratos (Pydantic) de entrada y salida del módulo promociones."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PromocionBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    descripcion: str = Field(min_length=3, max_length=200)
    fecha_inicio: date
    fecha_fin: date
    descuento: Decimal = Field(gt=0, le=100, max_digits=5, decimal_places=2)


class PromocionCreate(PromocionBase):
    """CA1 a CA3: datos para registrar una promoción."""

    productos_ids: list[int]


class PromocionUpdate(BaseModel):
    """CA4: actualización parcial; solo se aplican los campos enviados."""

    model_config = ConfigDict(str_strip_whitespace=True)

    descripcion: str | None = Field(default=None, min_length=3, max_length=200)
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    descuento: Decimal | None = Field(
        default=None, gt=0, le=100, max_digits=5, decimal_places=2
    )
    productos_ids: list[int] | None = None


class PromocionEstadoIn(BaseModel):
    """CA5: activar o desactivar una promoción."""

    activo: bool


class ProductoPromocionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


class PromocionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    descripcion: str
    fecha_inicio: date
    fecha_fin: date
    descuento: Decimal
    activo: bool
    vigente: bool
    productos: list[ProductoPromocionOut]
