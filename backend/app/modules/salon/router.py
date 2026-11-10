"""Módulo salon: sectores y mesas del salón (HU-01a, HU-01b)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.enums import Rol
from app.modules.salon.schemas import (
    MesaCreate,
    MesaOut,
    MesaUpdate,
    SectorCreate,
    SectorOut,
    SectorUpdate,
)
from app.modules.salon.service import MesaService, SectorService

router = APIRouter()
solo_admin = [Depends(require_roles(Rol.ADMINISTRADOR))]
# Lectura para quien arma reservas (HU-11a) y para el filtro del reporte de
# ocupación (HU-12d). El mozo usa el tablero de mesas de comandas.
lectura = [
    Depends(require_roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA, Rol.ENCARGADO_GENERAL))
]


# --- Sectores (HU-01a) ---


@router.get(
    "/sectores",
    response_model=list[SectorOut],
    dependencies=lectura,
    summary="Listar sectores con su cantidad de mesas",
)
def listar_sectores(db: Session = Depends(get_db)):
    return SectorService(db).listar()


@router.post(
    "/sectores",
    response_model=SectorOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=solo_admin,
    summary="Crear sector",
)
def crear_sector(datos: SectorCreate, db: Session = Depends(get_db)):
    return SectorService(db).crear(datos)


@router.put(
    "/sectores/{sector_id}",
    response_model=SectorOut,
    dependencies=solo_admin,
    summary="Modificar sector",
)
def modificar_sector(
    sector_id: int, datos: SectorUpdate, db: Session = Depends(get_db)
):
    return SectorService(db).modificar(sector_id, datos)


@router.delete(
    "/sectores/{sector_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=solo_admin,
    summary="Eliminar sector (baja lógica)",
)
def eliminar_sector(sector_id: int, db: Session = Depends(get_db)):
    SectorService(db).eliminar(sector_id)


# --- Mesas (HU-01b) ---


@router.get(
    "/mesas",
    response_model=list[MesaOut],
    dependencies=lectura,
    summary="Listar mesas con su disponibilidad (opcional: de un sector)",
)
def listar_mesas(
    sector_id: int | None = Query(default=None), db: Session = Depends(get_db)
):
    return MesaService(db).listar(sector_id)


@router.post(
    "/mesas",
    response_model=MesaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=solo_admin,
    summary="Crear mesa",
)
def crear_mesa(datos: MesaCreate, db: Session = Depends(get_db)):
    return MesaService(db).crear(datos)


@router.put(
    "/mesas/{mesa_id}",
    response_model=MesaOut,
    dependencies=solo_admin,
    summary="Modificar mesa",
)
def modificar_mesa(mesa_id: int, datos: MesaUpdate, db: Session = Depends(get_db)):
    return MesaService(db).modificar(mesa_id, datos)


@router.delete(
    "/mesas/{mesa_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=solo_admin,
    summary="Eliminar mesa (baja lógica)",
)
def eliminar_mesa(mesa_id: int, db: Session = Depends(get_db)):
    MesaService(db).eliminar(mesa_id)
