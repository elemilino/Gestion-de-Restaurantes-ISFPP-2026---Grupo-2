"""Módulo carta: secciones, productos, stock y ver carta.

Lo completan: HU-03a, HU-03b, HU-04a, HU-04b, HU-04c, HU-04d.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.enums import Rol, TipoProducto
from app.modules.carta.schemas import (
    BebidaCreate,
    BebidaUpdate,
    PlatoCreate,
    PlatoUpdate,
    PostreCreate,
    PostreUpdate,
    ProductoOut,
    SeccionCreate,
    SeccionOut,
    SeccionUpdate,
)
from app.modules.carta.service import ProductoService, SeccionService

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


# --- Productos: comunes a todos los tipos (HU-04a) ---


@router.get(
    "/productos",
    response_model=list[ProductoOut],
    dependencies=solo_admin,
    summary="Listar productos (administración)",
)
def listar_productos(
    tipo: TipoProducto | None = Query(default=None),
    seccion_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return ProductoService(db).listar(tipo, seccion_id)


@router.get(
    "/productos/{producto_id}",
    response_model=ProductoOut,
    dependencies=solo_admin,
    summary="Ver un producto",
)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    return ProductoService(db).obtener(producto_id)


@router.delete(
    "/productos/{producto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=solo_admin,
    summary="Eliminar producto de cualquier tipo (baja lógica)",
)
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    ProductoService(db).eliminar(producto_id)


# --- Platos (HU-04a) ---


@router.post(
    "/platos",
    response_model=ProductoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=solo_admin,
    summary="Crear plato",
)
def crear_plato(datos: PlatoCreate, db: Session = Depends(get_db)):
    return ProductoService(db).crear(TipoProducto.PLATO, datos)


@router.put(
    "/platos/{producto_id}",
    response_model=ProductoOut,
    dependencies=solo_admin,
    summary="Modificar plato",
)
def modificar_plato(
    producto_id: int, datos: PlatoUpdate, db: Session = Depends(get_db)
):
    return ProductoService(db).modificar(producto_id, TipoProducto.PLATO, datos)


# --- Postres (HU-04b) ---


@router.post(
    "/postres",
    response_model=ProductoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=solo_admin,
    summary="Crear postre",
)
def crear_postre(datos: PostreCreate, db: Session = Depends(get_db)):
    return ProductoService(db).crear(TipoProducto.POSTRE, datos)


@router.put(
    "/postres/{producto_id}",
    response_model=ProductoOut,
    dependencies=solo_admin,
    summary="Modificar postre",
)
def modificar_postre(
    producto_id: int, datos: PostreUpdate, db: Session = Depends(get_db)
):
    return ProductoService(db).modificar(producto_id, TipoProducto.POSTRE, datos)


# --- Bebidas (HU-04c) ---


@router.post(
    "/bebidas",
    response_model=ProductoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=solo_admin,
    summary="Crear bebida",
)
def crear_bebida(datos: BebidaCreate, db: Session = Depends(get_db)):
    return ProductoService(db).crear(TipoProducto.BEBIDA, datos)


@router.put(
    "/bebidas/{producto_id}",
    response_model=ProductoOut,
    dependencies=solo_admin,
    summary="Modificar bebida",
)
def modificar_bebida(
    producto_id: int, datos: BebidaUpdate, db: Session = Depends(get_db)
):
    return ProductoService(db).modificar(producto_id, TipoProducto.BEBIDA, datos)
