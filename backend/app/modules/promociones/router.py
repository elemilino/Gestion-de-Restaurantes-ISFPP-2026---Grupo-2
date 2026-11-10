"""Módulo promociones: gestión de promociones (HU-09a)."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.enums import Rol
from app.modules.promociones.schemas import (
    PromocionCreate,
    PromocionEstadoIn,
    PromocionOut,
    PromocionUpdate,
)
from app.modules.promociones.service import PromocionService

router = APIRouter()
solo_admin = [Depends(require_roles(Rol.ADMINISTRADOR))]

EstadoFiltro = Literal["todas", "vigentes", "programadas", "vencidas", "inactivas"]


@router.get(
    "",
    response_model=list[PromocionOut],
    dependencies=solo_admin,
    summary="Listar promociones",
)
def listar_promociones(
    estado: EstadoFiltro | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Lista las promociones y filtra por estado. Desactiva las vencidas (CA5)."""
    return PromocionService(db).listar(estado)


@router.post(
    "",
    response_model=PromocionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=solo_admin,
    summary="Registrar promoción (CA1-CA3)",
)
def crear_promocion(datos: PromocionCreate, db: Session = Depends(get_db)):
    """Registra una promoción activa vinculada a uno o más productos."""
    return PromocionService(db).crear(datos)


@router.get(
    "/{promocion_id}",
    response_model=PromocionOut,
    dependencies=solo_admin,
    summary="Obtener una promoción",
)
def obtener_promocion(promocion_id: int, db: Session = Depends(get_db)):
    return PromocionService(db).obtener(promocion_id)


@router.put(
    "/{promocion_id}",
    response_model=PromocionOut,
    dependencies=solo_admin,
    summary="Modificar promoción (CA4)",
)
def modificar_promocion(
    promocion_id: int,
    datos: PromocionUpdate,
    db: Session = Depends(get_db),
):
    """Actualiza datos y productos; la vigencia se recalcula sola."""
    return PromocionService(db).modificar(promocion_id, datos)


@router.patch(
    "/{promocion_id}/activo",
    response_model=PromocionOut,
    dependencies=solo_admin,
    summary="Activar o desactivar promoción (CA5)",
)
def cambiar_estado_promocion(
    promocion_id: int,
    datos: PromocionEstadoIn,
    db: Session = Depends(get_db),
):
    return PromocionService(db).cambiar_estado(promocion_id, datos.activo)


@router.delete(
    "/{promocion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=solo_admin,
    summary="Dar de baja una promoción (CA5)",
)
def eliminar_promocion(promocion_id: int, db: Session = Depends(get_db)):
    """Baja lógica: la promoción deja de aplicarse sin perder el historial."""
    PromocionService(db).eliminar(promocion_id)
