"""Contratos (Pydantic) de entrada y salida del módulo carta."""

from pydantic import BaseModel, ConfigDict, Field


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
