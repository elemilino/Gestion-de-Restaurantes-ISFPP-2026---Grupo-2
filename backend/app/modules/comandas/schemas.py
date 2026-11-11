from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.enums import EstadoComanda


class ComandaCrear(BaseModel):
    """Lo que envía el mozo al crear una comanda (HU-05a).

    Con `reserva_id` (CA8) las mesas y los comensales salen de la reserva.
    """

    dni_mozo: str = Field(min_length=7, max_length=8, pattern=r"^\d+$")
    cantidad_comensales: int | None = Field(default=None, gt=0)
    numeros_mesa: list[int] | None = Field(default=None, min_length=1)
    reserva_id: int | None = None

    @field_validator("numeros_mesa")
    @classmethod
    def sin_mesas_repetidas(cls, valor: list[int] | None) -> list[int] | None:
        if valor is not None and len(set(valor)) != len(valor):
            raise ValueError("No se puede repetir una mesa en la misma comanda")
        return valor

    @model_validator(mode="after")
    def mesas_y_comensales_o_reserva(self) -> "ComandaCrear":
        if self.reserva_id is None and (
            self.cantidad_comensales is None or self.numeros_mesa is None
        ):
            raise ValueError("Indicá la cantidad de comensales y las mesas")
        return self


class ComandaModificar(BaseModel):
    """Datos de cabecera que se pueden cambiar (HU-05b). Todos opcionales."""

    dni_mozo: str | None = Field(
        default=None, min_length=7, max_length=8, pattern=r"^\d+$"
    )
    cantidad_comensales: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def al_menos_un_campo(self) -> "ComandaModificar":
        if self.dni_mozo is None and self.cantidad_comensales is None:
            raise ValueError("Debe indicar al menos un dato a modificar")
        return self


class DetalleAgregar(BaseModel):
    """Producto y cantidad a agregar a una comanda (HU-05b)."""

    producto_id: int = Field(gt=0)
    cantidad: int = Field(gt=0)


class DetalleCantidad(BaseModel):
    """Nueva cantidad de un detalle existente (HU-05b)."""

    cantidad: int = Field(gt=0)


class DetalleEntrega(BaseModel):
    """Estado de entrega de un detalle de comanda en mesa (HU-06)."""

    entregado: bool = True


class ComandaAnular(BaseModel):
    """Motivo obligatorio para anular una comanda abierta (HU-06 CA3)."""

    motivo: str = Field(min_length=3, max_length=200)

    @field_validator("motivo")
    @classmethod
    def motivo_no_vacio(cls, valor: str) -> str:
        limpio = valor.strip()
        if len(limpio) < 3:
            raise ValueError("El motivo debe tener al menos 3 caracteres")
        return limpio


class MozoResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dni: str
    nombre: str
    apellido: str


class MesaResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    numero: int
    capacidad: int


class ProductoResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    precio: Decimal


class DetalleRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    producto: ProductoResumen
    cantidad: int
    precio_unitario: Decimal
    entregado: bool


class ComandaRespuesta(BaseModel):
    """Lo que devuelve la API al crear, modificar o consultar una comanda."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    cantidad_comensales: int
    fecha_hora_apertura: datetime
    fecha_hora_cierre: datetime | None
    estado: EstadoComanda
    motivo_anulacion: str | None = None
    reserva_id: int | None = None
    abierta: bool
    mozo: MozoResumen
    mesas: list[MesaResumen]
    detalles: list[DetalleRespuesta]


class MesaTableroOut(BaseModel):
    """Mesa del salón con su estado operativo y comanda para el tablero (/mesas)."""

    id: int
    numero: int
    capacidad: int
    sector_id: int
    sector_nombre: str
    estado_mesa: str
    comanda: ComandaRespuesta | None = None


# HU-05f
class ComandaFiltros(BaseModel):
    """Filtros opcionales del listado (HU-05f)."""

    dni_mozo: str | None = Field(
        default=None, min_length=7, max_length=8, pattern=r"^\d+$"
    )
    fecha_desde: date | None = None
    fecha_hasta: date | None = None
    abierta: bool | None = None
