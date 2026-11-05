"""Contratos (Pydantic) de entrada y salida del módulo salón."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# --- Sectores (HU-01a) ---


class SectorCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(min_length=1, max_length=50)
    descripcion: str | None = Field(default=None, max_length=200)

    @field_validator("descripcion")
    @classmethod
    def _descripcion_vacia_es_nula(cls, valor: str | None) -> str | None:
        return valor or None


class SectorUpdate(SectorCreate):
    """El PUT reemplaza todos los datos editables del sector."""


class SectorOut(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    cantidad_mesas: int = 0


# --- Mesas (HU-01b) ---

# Disponibilidad actual de la mesa (CA8): OCUPADA si tiene una comanda abierta,
# RESERVADA si tiene una reserva activa para hoy y LIBRE en otro caso.
Disponibilidad = Literal["LIBRE", "OCUPADA", "RESERVADA"]


class MesaCreate(BaseModel):
    """La capacidad no se valida acá: la valida el service con el mensaje de CA3."""

    numero: int = Field(gt=0)
    capacidad: int
    sector_id: int


class MesaUpdate(MesaCreate):
    """El PUT reemplaza todos los datos editables de la mesa."""


class MesaOut(BaseModel):
    id: int
    numero: int
    capacidad: int
    sector_id: int
    sector_nombre: str
    disponibilidad: Disponibilidad
