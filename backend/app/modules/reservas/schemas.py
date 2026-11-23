"""Schemas de reservas (HU-11a y HU-11b)."""

from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import EstadoReserva


class SenaCrear(BaseModel):
    """Seña obligatoria (HU-11a CA6). El monto se valida en el service."""

    monto: Decimal = Field(max_digits=12, decimal_places=2)
    medio_pago_id: int


class ItemMenuAcordado(BaseModel):
    """Plato del menú acordado (HU-11a CA7). Cantidad y precio en el service."""

    producto_id: int
    cantidad: int
    precio_acordado: Decimal = Field(max_digits=12, decimal_places=2)


class ReservaDatos(BaseModel):
    """Datos editables de una reserva (alta y modificación)."""

    fecha: date
    hora: time
    duracion_horas: int = Field(default=1, ge=1, le=12)
    cantidad_comensales: int = Field(gt=0)
    numeros_mesa: list[int] = Field(min_length=1)
    cliente_id: int
    menu_acordado: list[ItemMenuAcordado] = []

    @field_validator("numeros_mesa")
    @classmethod
    def sin_mesas_repetidas(cls, valor: list[int]) -> list[int]:
        if len(set(valor)) != len(valor):
            raise ValueError("No se puede repetir una mesa en la misma reserva")
        return valor


class ReservaCrear(ReservaDatos):
    sena: SenaCrear | None = None


class ReservaFiltros(BaseModel):
    """Filtros opcionales del listado (HU-11a CA11)."""

    fecha: date | None = None
    estado: EstadoReserva | None = None
    cliente_id: int | None = None
    # Para el mozo: reservas cumplidas que todavía no tienen comanda (HU-05a CA8).
    sin_comanda: bool | None = None


class ClienteResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    apellido: str
    dni: str
    telefono: str


class MesaResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    numero: int
    capacidad: int


class SenaOut(BaseModel):
    monto: Decimal
    fecha: datetime
    medio_pago_id: int
    medio_pago_nombre: str
    devuelta: bool


class ItemMenuOut(BaseModel):
    producto_id: int
    producto_nombre: str
    cantidad: int
    precio: Decimal


class ReservaOut(BaseModel):
    id: int
    nro_reserva: int
    fecha_hora: datetime
    fecha: date
    hora: time
    duracion_horas: int
    cantidad_comensales: int
    estado: EstadoReserva
    cliente: ClienteResumen | None
    mesas: list[MesaResumen]
    sena: SenaOut | None
    menu_acordado: list[ItemMenuOut]
    fecha_hora_llegada: datetime | None
    tiene_comanda: bool
