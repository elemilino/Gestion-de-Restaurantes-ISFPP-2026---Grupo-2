"""Módulo carta: secciones, productos, stock y ver carta.

Lo completan: HU-03a, HU-03b, HU-04a, HU-04b, HU-04c, HU-04d.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.enums import Rol
from app.modules.carta.schemas import SeccionCreate, SeccionOut, SeccionUpdate
from app.modules.carta.service import SeccionService

router = APIRouter()
solo_admin = [Depends(require_roles(Rol.ADMINISTRADOR))]


# --- Secciones (HU-03a) ---


@router.get(
    "/secciones",
    response_model=list[SeccionOut],
    dependencies=solo_admin,
    summary="Listar secciones de la carta",
)
def listar_secciones(db: Session = Depends(get_db)):
    return SeccionService(db).listar()


@router.post(
    "/secciones",
    response_model=SeccionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=solo_admin,
    summary="Crear sección",
)
def crear_seccion(datos: SeccionCreate, db: Session = Depends(get_db)):
    return SeccionService(db).crear(datos)


@router.put(
    "/secciones/{seccion_id}",
    response_model=SeccionOut,
    dependencies=solo_admin,
    summary="Modificar sección",
)
def modificar_seccion(
    seccion_id: int, datos: SeccionUpdate, db: Session = Depends(get_db)
):
    return SeccionService(db).modificar(seccion_id, datos)


@router.delete(
    "/secciones/{seccion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=solo_admin,
    summary="Eliminar sección (baja lógica)",
)
def eliminar_seccion(seccion_id: int, db: Session = Depends(get_db)):
    SeccionService(db).eliminar(seccion_id)
