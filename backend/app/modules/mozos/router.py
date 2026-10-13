"""Módulo mozos: gestión de mozos y asignación de sectores (HU-02)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.enums import Rol
from app.models.usuario import Usuario
from app.modules.mozos.schemas import (
    MozoCreate,
    MozoOut,
    MozoUpdate,
    ReasignarComandasOut,
    ReasignarComandasRequest,
    SectorSimpleOut,
    ValidarMesaResponse,
)
from app.modules.mozos.service import MozoService

router = APIRouter()
solo_admin = [Depends(require_roles(Rol.ADMINISTRADOR))]


@router.get(
    "/sectores",
    response_model=list[SectorSimpleOut],
    dependencies=solo_admin,
    summary="Listar sectores disponibles para asignación",
)
def listar_sectores_disponibles(db: Session = Depends(get_db)):
    """Devuelve los sectores activos del salón para asignar a mozos."""
    return MozoService(db).listar_sectores()


@router.get(
    "/mi-perfil",
    response_model=MozoOut,
    summary="Obtener perfil y sector del mozo autenticado",
)
def mi_perfil(
    usuario: Usuario = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Devuelve los datos del mozo en sesión y su sector asignado."""
    return MozoService(db).obtener_mi_perfil(usuario)


@router.post(
    "/validar-mesa/{mesa_id}",
    response_model=ValidarMesaResponse,
    summary="Validar permiso de operación sobre una mesa (CA2)",
)
def validar_mesa(
    mesa_id: int,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Valida que la mesa pertenezca estrictamente al sector asignado al mozo."""
    return MozoService(db).validar_operacion_mesa(usuario, mesa_id)


@router.get(
    "",
    response_model=list[MozoOut],
    dependencies=solo_admin,
    summary="Listar mozos",
)
def listar_mozos(db: Session = Depends(get_db)):
    """Lista todos los mozos activos con su sector y usuario asociado."""
    return MozoService(db).listar()


@router.post(
    "",
    response_model=MozoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=solo_admin,
    summary="Crear mozo (CA1)",
)
def crear_mozo(datos: MozoCreate, db: Session = Depends(get_db)):
    """Da de alta un mozo, crea su usuario de acceso y le asigna un sector."""
    return MozoService(db).crear(datos)


@router.get(
    "/{id}",
    response_model=MozoOut,
    dependencies=solo_admin,
    summary="Obtener detalle de un mozo",
)
def obtener_mozo(id: int, db: Session = Depends(get_db)):
    """Obtiene los datos de un mozo activo por ID."""
    return MozoService(db).obtener_por_id(id)


@router.put(
    "/{id}",
    response_model=MozoOut,
    dependencies=solo_admin,
    summary="Modificar mozo y reasignar sector (CA1)",
)
def modificar_mozo(id: int, datos: MozoUpdate, db: Session = Depends(get_db)):
    """Modifica datos personales y/o sector asignado a un mozo."""
    return MozoService(db).modificar(id, datos)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=solo_admin,
    summary="Dar de baja un mozo (CA3)",
)
def eliminar_mozo(id: int, db: Session = Depends(get_db)):
    """Inhabilita al mozo y su usuario. Exige que no tenga comandas activas."""
    MozoService(db).eliminar(id)


@router.post(
    "/{id}/reasignar-comandas",
    response_model=ReasignarComandasOut,
    dependencies=solo_admin,
    summary="Reasignar comandas activas a otro mozo (CA3)",
)
def reasignar_comandas(
    id: int, datos: ReasignarComandasRequest, db: Session = Depends(get_db)
):
    """Transfiere todas las comandas activas a otro mozo activo."""
    return MozoService(db).reasignar_comandas(id, datos.nuevo_mozo_id)
