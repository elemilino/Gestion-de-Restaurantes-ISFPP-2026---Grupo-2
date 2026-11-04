"""Contratos (Pydantic) de entrada y salida del módulo clientes."""

import re
import unicodedata

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# Letras Unicode (tildes, ñ) separadas por espacios, apóstrofes, puntos o guiones.
_PALABRAS = re.compile(r"[^\W\d_]+(?:[\s'.-]+[^\W\d_]+)*")


def _validar_email(valor: str | None) -> str | None:
    if valor is None or valor == "":
        return None
    if not _EMAIL.fullmatch(valor):
        raise ValueError("El correo electrónico no es válido")
    return valor


def _validar_palabras(valor: str, campo: str) -> str:
    texto = unicodedata.normalize("NFC", valor)
    if not _PALABRAS.fullmatch(texto):
        raise ValueError(
            f"El {campo} solo puede contener letras, espacios, apóstrofes y guiones"
        )
    return texto


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

    @field_validator("nombre", "apellido")
    @classmethod
    def _nombre_y_apellido_solo_letras(cls, valor: str, info: ValidationInfo) -> str:
        return _validar_palabras(valor, info.field_name)


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

    @field_validator("nombre", "apellido")
    @classmethod
    def _nombre_y_apellido_solo_letras(
        cls, valor: str | None, info: ValidationInfo
    ) -> str | None:
        if valor is None:
            return None
        return _validar_palabras(valor, info.field_name)


class ClienteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    apellido: str
    telefono: str
    dni: str
    email: str | None = None
    eliminado: bool
