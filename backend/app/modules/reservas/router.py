"""Endpoints de reservas (HU-11a registro, HU-11b atención).

Lectura: administrador, recepcionista y mozo (el mozo necesita ver las reservas
cumplidas para abrir la comanda, HU-05a CA8). Escritura: administrador y
recepcionista.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.enums import Rol
from app.modules.reservas.schemas import (
    ReservaCrear,
    ReservaDatos,
    ReservaFiltros,
    ReservaOut,
)
from app.modules.reservas.service import ReservaService

router = APIRouter()

lectura = [Depends(require_roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA, Rol.MOZO))]
escritura = [Depends(require_roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA))]


@router.get(
    "",
    response_model=list[ReservaOut],
    dependencies=lectura,
    summary="Listar reservas por fecha, estado o cliente (HU-11a CA11)",
)
def listar_reservas(
    filtros: ReservaFiltros = Depends(), db: Session = Depends(get_db)
) -> list[ReservaOut]:
    return ReservaService(db).listar(filtros)


@router.get(
    "/{reserva_id}",
    response_model=ReservaOut,
    dependencies=lectura,
    summary="Obtener una reserva",
)
def obtener_reserva(reserva_id: int, db: Session = Depends(get_db)) -> ReservaOut:
    return ReservaService(db).obtener(reserva_id)


@router.post(
    "",
    response_model=ReservaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=escritura,
    summary="Crear reserva con seña y menú acordado (HU-11a CA1 a CA8)",
)
def crear_reserva(datos: ReservaCrear, db: Session = Depends(get_db)) -> ReservaOut:
    return ReservaService(db).crear(datos)


@router.put(
    "/{reserva_id}",
    response_model=ReservaOut,
    dependencies=escritura,
    summary="Modificar una reserva activa (HU-11a CA9)",
)
def modificar_reserva(
    reserva_id: int, datos: ReservaDatos, db: Session = Depends(get_db)
) -> ReservaOut:
    return ReservaService(db).modificar(reserva_id, datos)


@router.post(
    "/{reserva_id}/cancelacion",
    response_model=ReservaOut,
    dependencies=escritura,
    summary="Cancelación anticipada: devuelve la seña (HU-11a CA10)",
)
def cancelar_reserva(reserva_id: int, db: Session = Depends(get_db)) -> ReservaOut:
    return ReservaService(db).cancelar(reserva_id)


@router.post(
    "/{reserva_id}/llegada",
    response_model=ReservaOut,
    dependencies=escritura,
    summary="Registrar la llegada del cliente (HU-11b CA1)",
)
def registrar_llegada(reserva_id: int, db: Session = Depends(get_db)) -> ReservaOut:
    return ReservaService(db).registrar_llegada(reserva_id)


@router.post(
    "/{reserva_id}/ausencia",
    response_model=ReservaOut,
    dependencies=escritura,
    summary="Registrar la ausencia tras 15 min de tolerancia (HU-11b CA2, CA3)",
)
def registrar_ausencia(reserva_id: int, db: Session = Depends(get_db)) -> ReservaOut:
    return ReservaService(db).registrar_ausencia(reserva_id)
