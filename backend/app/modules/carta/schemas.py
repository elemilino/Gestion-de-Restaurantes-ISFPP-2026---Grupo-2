"""Contratos (Pydantic) de entrada y salida del módulo carta."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import TipoProducto


class SeccionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(min_length=3, max_length=50)
    orden: int | None = Field(default=None, ge=1)


class SeccionUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(min_length=3, max_length=50)
    orden: int = Field(ge=1)


class SeccionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    orden: int
    cantidad_productos: int = 0


# --- Productos (HU-04a a HU-04d) ---


class ProductoBase(BaseModel):
    """Datos comunes a plato, postre y bebida."""

    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(min_length=3, max_length=60)
    descripcion: str | None = Field(default=None, max_length=200)
    precio: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    seccion_id: int

    @field_validator("descripcion")
    @classmethod
    def _descripcion_vacia_es_nula(cls, valor: str | None) -> str | None:
        return valor or None


class PlatoCreate(ProductoBase):
    porcion_gramos: int | None = Field(default=None, gt=0)


class PlatoUpdate(PlatoCreate):
    """El PUT reemplaza todos los datos editables del plato."""


class ProductoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    descripcion: str | None
    precio: Decimal
    tipo: TipoProducto
    seccion_id: int
    porcion_gramos: int | None
    disponible: bool
    stock: int | None
