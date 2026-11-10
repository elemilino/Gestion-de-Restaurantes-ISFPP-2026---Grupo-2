"""Módulo carta: secciones, productos, stock, menús y ver carta.

Lo completan: HU-03a, HU-03b, HU-04a, HU-04b, HU-04c, HU-04d y HU-09b.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.enums import Rol, TipoProducto
from app.modules.carta.schemas import (
    BebidaCreate,
    BebidaUpdate,
    CartaOut,
    DisponibilidadIn,
    MenuDelDiaIn,
    MenuEjecutivoIn,
    MenuOut,
    PlatoCreate,
    PlatoUpdate,
    PostreCreate,
    PostreUpdate,
    ProductoOut,
    SeccionCreate,
    SeccionOut,
    SeccionUpdate,
    StockIn,
)
from app.modules.carta.menus import MenuService
from app.modules.carta.service import CartaService, ProductoService, SeccionService

router = APIRouter()
solo_admin = [Depends(require_roles(Rol.ADMINISTRADOR))]
# HU-09b: los menús los arman el cocinero y el encargado general.
menus = [Depends(require_roles(Rol.ADMINISTRADOR, Rol.ENCARGADO_GENERAL, Rol.COCINERO))]
con_sesion = [Depends(get_current_user)]


# --- Ver carta (HU-03b) ---


@router.get(
    "",
    response_model=CartaOut,
    dependencies=con_sesion,
    summary="Ver la carta (secciones con sus productos)",
)
def ver_carta(
    seccion_id: int | None = Query(default=None), db: Session = Depends(get_db)
):
    return CartaService(db).ver_carta(seccion_id)


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


# --- Stock y disponibilidad (HU-04d) ---


@router.patch(
    "/productos/{producto_id}/disponibilidad",
    response_model=ProductoOut,
    dependencies=solo_admin,
    summary="Marcar producto disponible / no disponible",
)
def cambiar_disponibilidad(
    producto_id: int, datos: DisponibilidadIn, db: Session = Depends(get_db)
):
    return ProductoService(db).cambiar_disponibilidad(producto_id, datos.disponible)


@router.patch(
    "/productos/{producto_id}/stock",
    response_model=ProductoOut,
    dependencies=solo_admin,
    summary="Cargar, cambiar o quitar el stock de un producto",
)
def cambiar_stock(producto_id: int, datos: StockIn, db: Session = Depends(get_db)):
    return ProductoService(db).cambiar_stock(producto_id, datos.stock)


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


# --- Menús especiales (HU-09b) ---


@router.get(
    "/menus",
    response_model=list[MenuOut],
    dependencies=menus,
    summary="Listar menús especiales (ejecutivo y del día)",
)
def listar_menus(
    tipo: TipoProducto | None = Query(default=None), db: Session = Depends(get_db)
):
    return MenuService(db).listar(tipo)


@router.post(
    "/menus-ejecutivos",
    response_model=MenuOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=menus,
    summary="Crear menú ejecutivo: plato + postre (HU-09b)",
)
def crear_menu_ejecutivo(datos: MenuEjecutivoIn, db: Session = Depends(get_db)):
    return MenuService(db).crear(TipoProducto.MENU_EJECUTIVO, datos)


@router.put(
    "/menus-ejecutivos/{menu_id}",
    response_model=MenuOut,
    dependencies=menus,
    summary="Modificar menú ejecutivo (HU-09b)",
)
def modificar_menu_ejecutivo(
    menu_id: int, datos: MenuEjecutivoIn, db: Session = Depends(get_db)
):
    return MenuService(db).modificar(menu_id, TipoProducto.MENU_EJECUTIVO, datos)


@router.post(
    "/menus-del-dia",
    response_model=MenuOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=menus,
    summary="Crear menú del día (HU-09b)",
)
def crear_menu_del_dia(datos: MenuDelDiaIn, db: Session = Depends(get_db)):
    return MenuService(db).crear(TipoProducto.MENU_DEL_DIA, datos)


@router.put(
    "/menus-del-dia/{menu_id}",
    response_model=MenuOut,
    dependencies=menus,
    summary="Modificar menú del día (HU-09b)",
)
def modificar_menu_del_dia(
    menu_id: int, datos: MenuDelDiaIn, db: Session = Depends(get_db)
):
    return MenuService(db).modificar(menu_id, TipoProducto.MENU_DEL_DIA, datos)


@router.delete(
    "/menus/{menu_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=menus,
    summary="Eliminar menú especial: baja lógica (HU-09b)",
)
def eliminar_menu(menu_id: int, db: Session = Depends(get_db)):
    MenuService(db).eliminar(menu_id)
