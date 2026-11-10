"""HU-09b: menús especiales (ejecutivo y del día).

En el diagrama de clases Menu hereda de Producto, así que un menú es un Producto
más de la carta (con sección, precio, disponibilidad y stock) que además tiene
vigencia y componentes. Se ofrece en "Ver carta" y en las comandas solo mientras
está vigente.
"""

from sqlalchemy.orm import Session

from app.core.enums import TIPOS_MENU, TipoProducto
from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.carta import Producto
from app.modules.carta.repository import ProductoRepository
from app.modules.carta.schemas import MenuBase, MenuEjecutivoIn
from app.modules.carta.service import ProductoService


class MenuService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ProductoRepository(db)
        self.productos = ProductoService(db)

    def listar(self, tipo: TipoProducto | None = None) -> list[Producto]:
        """Menús activos (vigentes o no), ordenados por nombre."""
        if tipo is not None:
            return self.repo.listar_activos(tipo)
        return [p for t in TIPOS_MENU for p in self.repo.listar_activos(t)]

    def crear(self, tipo: TipoProducto, datos: MenuBase) -> Producto:
        """Ejecutivo CA1 y del día CA1."""
        self.productos._validar_seccion(datos.seccion_id)
        self.productos._validar_unico(tipo, datos)
        menu = Producto(tipo=tipo, activo=True, disponible=True, stock=None)
        self._asignar(menu, tipo, datos)
        self.db.add(menu)
        self.db.commit()
        self.db.refresh(menu)
        return menu

    def modificar(self, menu_id: int, tipo: TipoProducto, datos: MenuBase) -> Producto:
        """Ejecutivo CA3 y del día CA2: reemplaza los datos del menú."""
        menu = self._obtener(menu_id, tipo)
        self.productos._validar_seccion(datos.seccion_id)
        self.productos._validar_unico(tipo, datos, excluir_id=menu.id)
        self._asignar(menu, tipo, datos)
        self.db.commit()
        self.db.refresh(menu)
        return menu

    def eliminar(self, menu_id: int) -> None:
        """Ejecutivo CA4 y del día CA3: baja lógica, como el resto de productos.

        Las comandas que ya lo tienen lo conservan; si está en una comanda
        abierta, no se elimina (mismo control que HU-04a CA8).
        """
        self._obtener(menu_id)
        self.productos.eliminar(menu_id)

    def _obtener(self, menu_id: int, tipo: TipoProducto | None = None) -> Producto:
        menu = self.repo.obtener_activo(menu_id)
        if menu is None or not menu.es_menu or (tipo and menu.tipo != tipo):
            raise NotFoundError("El menú no existe", "MENU_NO_ENCONTRADO")
        return menu

    def _asignar(self, menu: Producto, tipo: TipoProducto, datos: MenuBase) -> None:
        plato = self.repo.obtener_activo(datos.plato_id)
        if plato is None or plato.tipo != TipoProducto.PLATO:
            raise BusinessRuleError(
                "El plato del menú tiene que ser un plato activo de la carta",
                "MENU_COMPONENTE_INVALIDO",
            )
        postre = None
        if tipo == TipoProducto.MENU_EJECUTIVO:
            assert isinstance(datos, MenuEjecutivoIn)
            postre = self.repo.obtener_activo(datos.postre_id)
            if postre is None or postre.tipo != TipoProducto.POSTRE:
                # CA2: el menú ejecutivo es plato + postre; una bebida no cuenta.
                raise BusinessRuleError(
                    "El menú ejecutivo lleva un plato y un postre (no incluye bebida)",
                    "MENU_COMPONENTE_INVALIDO",
                )
        menu.nombre = datos.nombre
        menu.descripcion = datos.descripcion
        menu.precio = datos.precio
        menu.seccion_id = datos.seccion_id
        menu.fecha_inicio = datos.fecha_inicio
        menu.fecha_fin = datos.fecha_fin
        menu.plato_id = plato.id
        menu.postre_id = postre.id if postre else None
