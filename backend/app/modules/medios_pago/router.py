"""Endpoints del módulo medios_pago (HU-07a, HU-07b)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.enums import Rol
from app.modules.medios_pago.schemas import (
    MedioPagoCreate,
    MedioPagoOut,
    MedioPagoUpdate,
)
from app.modules.medios_pago.service import MedioPagoService

router = APIRouter()
solo_admin = [Depends(require_roles(Rol.ADMINISTRADOR))]
con_sesion = [Depends(get_current_user)]


@router.get(
    "",
    response_model=list[MedioPagoOut],
    dependencies=con_sesion,
    summary="Listar medios de pago",
)
def listar_medios_pago(
    solo_activos: bool = Query(
        default=False, description="Filtrar solo medios de pago activos"
    ),
    db: Session = Depends(get_db),
):
    return MedioPagoService(db).listar(solo_activos=solo_activos)


@router.get(
    "/{medio_id}",
    response_model=MedioPagoOut,
    dependencies=con_sesion,
    summary="Obtener un medio de pago por ID",
)
def obtener_medio_pago(
    medio_id: int,
    db: Session = Depends(get_db),
):
    return MedioPagoService(db).obtener(medio_id)


@router.post(
    "",
    response_model=MedioPagoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=solo_admin,
    summary="Registrar un nuevo medio de pago (HU-07a CA1)",
)
def crear_medio_pago(
    datos: MedioPagoCreate,
    db: Session = Depends(get_db),
):
    return MedioPagoService(db).crear(datos)


@router.put(
    "/{medio_id}",
    response_model=MedioPagoOut,
    dependencies=solo_admin,
    summary="Modificar un medio de pago existente (HU-07b)",
)
def modificar_medio_pago(
    medio_id: int,
    datos: MedioPagoUpdate,
    db: Session = Depends(get_db),
):
    return MedioPagoService(db).modificar(medio_id, datos)


@router.delete(
    "/{medio_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=solo_admin,
    summary="Dar de baja lógica un medio de pago (HU-07b CA1)",
)
def eliminar_medio_pago(
    medio_id: int,
    db: Session = Depends(get_db),
):
    MedioPagoService(db).eliminar(medio_id)
