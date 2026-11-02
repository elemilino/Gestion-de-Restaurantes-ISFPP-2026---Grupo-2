"""Contratos (Pydantic) de entrada y salida del módulo mozos."""

from pydantic import BaseModel, ConfigDict, Field


class SectorSimpleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


class MozoCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=50)
    apellido: str = Field(min_length=2, max_length=50)
    dni: str = Field(min_length=7, max_length=8, pattern=r"^\d{7,8}$")
    telefono: str | None = Field(default=None, max_length=20)
    sector_id: int | None = None
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=4)


class MozoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=50)
    apellido: str | None = Field(default=None, min_length=2, max_length=50)
    telefono: str | None = Field(default=None, max_length=20)
    sector_id: int | None = None


class MozoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    apellido: str
    dni: str
    telefono: str | None = None
    sector_id: int | None = None
    sector_nombre: str | None = None
    usuario_id: int | None = None
    username: str | None = None
    activo: bool

    @classmethod
    def from_entity(cls, mozo) -> "MozoOut":
        return cls(
            id=mozo.id,
            nombre=mozo.nombre,
            apellido=mozo.apellido,
            dni=mozo.dni,
            telefono=mozo.telefono,
            sector_id=mozo.sector_id,
            sector_nombre=mozo.sector.nombre if mozo.sector else None,
            usuario_id=mozo.usuario_id,
            username=mozo.usuario.username if mozo.usuario else None,
            activo=mozo.activo,
        )


class ReasignarComandasRequest(BaseModel):
    nuevo_mozo_id: int


class ReasignarComandasOut(BaseModel):
    comandas_reasignadas: int
    mensaje: str


class ValidarMesaResponse(BaseModel):
    permitido: bool
    mensaje: str
    mesa_id: int
    sector_id: int | None = None
    sector_nombre: str | None = None
