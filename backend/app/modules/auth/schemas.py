"""Contratos (Pydantic) de entrada y salida del módulo auth."""

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import Rol


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1)


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    nombre: str
    rol: Rol


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut
