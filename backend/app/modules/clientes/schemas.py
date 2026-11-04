"""Contratos (Pydantic) de entrada y salida del módulo clientes."""

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validar_email(valor: str | None) -> str | None:
    if valor is None or valor == "":
        return None
    if not _EMAIL.fullmatch(valor):
        raise ValueError("El correo electrónico no es válido")
    return valor


class ClienteBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(min_length=2, max_length=50)
    apellido: str = Field(min_length=2, max_length=50)
    telefono: str = Field(min_length=6, max_length=20, pattern=r"^[0-9+\-\s()]+$")
    dni: str = Field(min_length=7, max_length=8, pattern=r"^\d{7,8}$")
    email: str | None = Field(default=None, max_length=100)

    @field_validator("email")
    @classmethod
    def _email_valido(cls, valor: str | None) -> str | None:
        return _validar_email(valor)


class ClienteCreate(ClienteBase):
    """CA1 a CA3: datos para registrar un cliente."""


class ClienteUpdate(BaseModel):
    """CA4: actualización parcial; solo se aplican los campos enviados."""

    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str | None = Field(default=None, min_length=2, max_length=50)
    apellido: str | None = Field(default=None, min_length=2, max_length=50)
    telefono: str | None = Field(
        default=None, min_length=6, max_length=20, pattern=r"^[0-9+\-\s()]+$"
    )
    dni: str | None = Field(
        default=None, min_length=7, max_length=8, pattern=r"^\d{7,8}$"
    )
    email: str | None = Field(default=None, max_length=100)

    @field_validator("email")
    @classmethod
    def _email_valido(cls, valor: str | None) -> str | None:
        return _validar_email(valor)


class ClienteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    apellido: str
    telefono: str
    dni: str
    email: str | None = None
    eliminado: bool
