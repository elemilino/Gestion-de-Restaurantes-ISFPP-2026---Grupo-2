"""Contratos (Pydantic) de entrada y salida del módulo carta."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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


class ProductoConPorcion(ProductoBase):
    """Plato y postre: datos comunes + porción en gramos (opcional)."""

    porcion_gramos: int | None = Field(default=None, gt=0)


class PlatoCreate(ProductoConPorcion):
    pass


class PlatoUpdate(ProductoConPorcion):
    """El PUT reemplaza todos los datos editables del plato."""


class PostreCreate(ProductoConPorcion):
    pass


class PostreUpdate(ProductoConPorcion):
    """El PUT reemplaza todos los datos editables del postre."""


class BebidaCreate(ProductoBase):
    """Bebida: datos comunes + volumen (obligatorio) y si es alcohólica."""

    volumen_ml: int = Field(gt=0)
    alcoholica: bool


class BebidaUpdate(BebidaCreate):
    """El PUT reemplaza todos los datos editables de la bebida."""


class ProductoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    descripcion: str | None
    precio: Decimal
    tipo: TipoProducto
    seccion_id: int
    porcion_gramos: int | None
    volumen_ml: int | None
    alcoholica: bool | None
    disponible: bool
    stock: int | None
    disponible_efectivo: bool


class DisponibilidadIn(BaseModel):
    disponible: bool


class StockIn(BaseModel):
    """`null` = dejar de controlar el stock del producto."""

    stock: int | None = Field(ge=0)


# --- Ver carta (HU-03b) ---


class ProductoCartaOut(BaseModel):
    """Producto tal como lo ve el mozo. `disponible` = disponibilidad efectiva."""

    id: int
    nombre: str
    descripcion: str | None
    precio: Decimal
    descuento_porcentaje: Decimal | None = None
    precio_final: Decimal | None = None
    promocion_descripcion: str | None = None
    tipo: TipoProducto
    porcion_gramos: int | None
    volumen_ml: int | None
    alcoholica: bool | None
    disponible: bool


class SeccionCartaOut(BaseModel):
    id: int
    nombre: str
    orden: int
    productos: list[ProductoCartaOut]


class CartaOut(BaseModel):
    secciones: list[SeccionCartaOut]


# --- Menús especiales (HU-09b) ---


class MenuBase(BaseModel):
    """Datos comunes del menú: los de producto, el plato y la vigencia."""

    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(min_length=3, max_length=60)
    descripcion: str | None = Field(default=None, max_length=200)
    precio: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    seccion_id: int
    plato_id: int
    fecha_inicio: date
    fecha_fin: date

    @field_validator("descripcion")
    @classmethod
    def _descripcion_vacia_es_nula(cls, valor: str | None) -> str | None:
        return valor or None

    @model_validator(mode="after")
    def _vigencia_valida(self):
        if self.fecha_fin < self.fecha_inicio:
            raise ValueError("La fecha de fin no puede ser anterior a la de inicio")
        return self


class MenuEjecutivoIn(MenuBase):
    """Menú ejecutivo: plato + postre. No incluye bebida (HU-09b CA2)."""

    postre_id: int


class MenuDelDiaIn(MenuBase):
    """Menú del día: un plato con precio promocional."""


class ComponenteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


class MenuOut(ProductoOut):
    fecha_inicio: date
    fecha_fin: date
    plato: ComponenteOut
    postre: ComponenteOut | None
    vigente: bool
