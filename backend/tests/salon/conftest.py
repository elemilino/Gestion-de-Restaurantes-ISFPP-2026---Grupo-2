"""Fixtures del módulo salón: crean sectores, mesas, comandas y reservas con `db`."""

from datetime import datetime, timedelta
from itertools import count

import pytest

from app.core.enums import EstadoComanda, EstadoReserva
from app.models.comandas import Comanda
from app.models.personal import Mozo
from app.models.reservas import Reserva
from app.models.salon import Mesa, Sector


@pytest.fixture
def crear_sector(db):
    def _crear(nombre: str, descripcion: str | None = None, activo: bool = True):
        sector = Sector(nombre=nombre, descripcion=descripcion, activo=activo)
        db.add(sector)
        db.commit()
        return sector

    return _crear


@pytest.fixture
def crear_mesa(db):
    def _crear(numero: int, sector: Sector, capacidad: int = 4, activo: bool = True):
        mesa = Mesa(
            numero=numero, capacidad=capacidad, sector_id=sector.id, activo=activo
        )
        db.add(mesa)
        db.commit()
        return mesa

    return _crear


@pytest.fixture
def crear_comanda(db):
    """Comanda en la mesa. HU-05 todavía no está integrada: se inserta directo."""
    dnis = count(1)

    def _crear(mesa: Mesa, estado: EstadoComanda = EstadoComanda.ABIERTA):
        mozo = Mozo(dni=f"{next(dnis):08d}", nombre="Mozo", apellido="Prueba")
        db.add(mozo)
        db.flush()
        comanda = Comanda(mesa_id=mesa.id, mozo_id=mozo.id, estado=estado)
        db.add(comanda)
        db.commit()
        return comanda

    return _crear


@pytest.fixture
def crear_reserva(db):
    """Reserva en una o varias mesas. Por defecto, activa para mañana a las 21."""

    def _crear(
        mesas: list[Mesa],
        comensales: int,
        estado: EstadoReserva = EstadoReserva.ACTIVA,
        fecha_hora: datetime | None = None,
    ):
        if fecha_hora is None:
            manana = datetime.now() + timedelta(days=1)
            fecha_hora = manana.replace(hour=21, minute=0, second=0, microsecond=0)
        reserva = Reserva(
            fecha_hora=fecha_hora,
            cantidad_comensales=comensales,
            estado=estado,
            mesas=mesas,
        )
        db.add(reserva)
        db.commit()
        return reserva

    return _crear
