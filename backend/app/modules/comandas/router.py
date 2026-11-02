from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.enums import Rol

from app.core.database import get_db
from app.models.comandas import Comanda
from app.modules.comandas.schemas import (
    ComandaCrear,
    ComandaModificar,
    ComandaRespuesta,
    DetalleAgregar,
    DetalleCantidad,
    ComandaFiltros,
)
from app.modules.comandas.service import ComandaService

router = APIRouter(dependencies=[Depends(require_roles(Rol.MOZO, Rol.ADMINISTRADOR))])


@router.post(
    "",
    response_model=ComandaRespuesta,
    status_code=status.HTTP_201_CREATED,
    summary="Crear comanda (HU-05a)",
)
def crear_comanda(datos: ComandaCrear, db: Session = Depends(get_db)) -> Comanda:
    return ComandaService(db).crear(datos)


# HU-05f
@router.get(
    "",
    response_model=list[ComandaRespuesta],
    summary="Listar comandas (HU-05f)",
)
def listar_comandas(
    filtros: ComandaFiltros = Depends(), db: Session = Depends(get_db)
) -> list[Comanda]:
    return ComandaService(db).listar(filtros)


#
@router.patch(
    "/{comanda_id}",
    response_model=ComandaRespuesta,
    summary="Modificar mozo o comensales (HU-05b)",
)
def modificar_comanda(
    comanda_id: int, datos: ComandaModificar, db: Session = Depends(get_db)
) -> Comanda:
    return ComandaService(db).modificar(comanda_id, datos)


@router.post(
    "/{comanda_id}/detalles",
    response_model=ComandaRespuesta,
    summary="Agregar producto a la comanda (HU-05b)",
)
def agregar_producto(
    comanda_id: int, datos: DetalleAgregar, db: Session = Depends(get_db)
) -> Comanda:
    return ComandaService(db).agregar_producto(comanda_id, datos)


@router.patch(
    "/{comanda_id}/detalles/{detalle_id}",
    response_model=ComandaRespuesta,
    summary="Cambiar cantidad de un producto (HU-05b)",
)
def cambiar_cantidad(
    comanda_id: int,
    detalle_id: int,
    datos: DetalleCantidad,
    db: Session = Depends(get_db),
) -> Comanda:
    return ComandaService(db).cambiar_cantidad(comanda_id, detalle_id, datos.cantidad)


@router.delete(
    "/{comanda_id}/detalles/{detalle_id}",
    response_model=ComandaRespuesta,
    summary="Quitar producto de la comanda (HU-05b)",
)
def quitar_producto(
    comanda_id: int, detalle_id: int, db: Session = Depends(get_db)
) -> Comanda:
    return ComandaService(db).quitar_producto(comanda_id, detalle_id)


# HU-05c
@router.post(
    "/{comanda_id}/cierre",
    response_model=ComandaRespuesta,
    summary="Cerrar comanda (HU-05c)",
)
def cerrar_comanda(comanda_id: int, db: Session = Depends(get_db)) -> Comanda:
    return ComandaService(db).cerrar(comanda_id)


# HU-05d
@router.post(
    "/{comanda_id}/reapertura",
    response_model=ComandaRespuesta,
    dependencies=[Depends(require_roles(Rol.ADMINISTRADOR))],
    summary="Reabrir comanda (HU-05d)",
)
def reabrir_comanda(comanda_id: int, db: Session = Depends(get_db)) -> Comanda:
    return ComandaService(db).reabrir(comanda_id)


#
# HU-05e
@router.delete(
    "/{comanda_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar comanda (HU-05e)",
)
def eliminar_comanda(comanda_id: int, db: Session = Depends(get_db)) -> Response:
    ComandaService(db).eliminar(comanda_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
