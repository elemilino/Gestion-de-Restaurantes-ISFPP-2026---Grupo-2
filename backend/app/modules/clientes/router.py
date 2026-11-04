"""Módulo clientes: base de clientes (HU-10)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.enums import Rol
from app.modules.clientes.schemas import ClienteCreate, ClienteOut, ClienteUpdate
from app.modules.clientes.service import ClienteService

router = APIRouter()
puede_gestionar = [Depends(require_roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA))]


@router.get(
    "",
    response_model=list[ClienteOut],
    dependencies=puede_gestionar,
    summary="Listar y buscar clientes",
)
def listar_clientes(
    busqueda: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """CA7: busca clientes activos por DNI, nombre o apellido."""
    return ClienteService(db).listar(busqueda)


@router.post(
    "",
    response_model=ClienteOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=puede_gestionar,
    summary="Registrar cliente (CA1-CA3)",
)
def crear_cliente(datos: ClienteCreate, db: Session = Depends(get_db)):
    """Registra un cliente activo y rechaza DNIs duplicados."""
    return ClienteService(db).crear(datos)


@router.get(
    "/{cliente_id}",
    response_model=ClienteOut,
    dependencies=puede_gestionar,
    summary="Obtener un cliente (CA7)",
)
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Devuelve los datos de un cliente activo."""
    return ClienteService(db).obtener(cliente_id)


@router.put(
    "/{cliente_id}",
    response_model=ClienteOut,
    dependencies=puede_gestionar,
    summary="Modificar un cliente (CA4)",
)
def modificar_cliente(
    cliente_id: int, datos: ClienteUpdate, db: Session = Depends(get_db)
):
    """Actualiza los datos enviados de un cliente existente."""
    return ClienteService(db).modificar(cliente_id, datos)


@router.delete(
    "/{cliente_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=puede_gestionar,
    summary="Dar de baja un cliente (CA5)",
)
def eliminar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Realiza la baja lógica. CA6 se completa con HU-11."""
    ClienteService(db).eliminar(cliente_id)
