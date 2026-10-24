"""Reglas de negocio del módulo carta. No conoce HTTP: lanza errores de dominio."""

from sqlalchemy.orm import Session

from app.core.enums import TipoProducto
from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.carta import Producto, SeccionCarta
from app.modules.carta.repository import ProductoRepository, SeccionRepository
from app.modules.carta.schemas import (
    ProductoBase,
    SeccionCreate,
    SeccionOut,
    SeccionUpdate,
)


class SeccionService:
    """HU-03a: gestión de secciones de la carta."""

    def __init__(self, db: Session):
        self.db = db
        self.secciones = SeccionRepository(db)

    def listar(self) -> list[SeccionOut]:
        """CA7: secciones activas en orden, con la cantidad de productos activos."""
        return [
            self._a_salida(seccion, cantidad)
            for seccion, cantidad in self.secciones.listar_activas_con_cantidad()
        ]

    def crear(self, datos: SeccionCreate) -> SeccionOut:
        """CA1 y CA2: crea la sección activa; sin orden, la pone al final."""
        self._validar_unica(datos.nombre)
        orden = datos.orden or self.secciones.max_orden() + 1
        seccion = SeccionCarta(nombre=datos.nombre, orden=orden, activo=True)
        self.db.add(seccion)
        self.db.commit()
        return self._a_salida(seccion, 0)

    def modificar(self, seccion_id: int, datos: SeccionUpdate) -> SeccionOut:
        """CA2 y CA4: cambia nombre y orden; los productos siguen asociados."""
        seccion = self._obtener(seccion_id)
        self._validar_unica(datos.nombre, excluir_id=seccion.id)
        seccion.nombre = datos.nombre
        seccion.orden = datos.orden
        self.db.commit()
        return self._a_salida(
            seccion, self.secciones.contar_productos_activos(seccion.id)
        )

    def eliminar(self, seccion_id: int) -> None:
        """CA5 y CA6: baja lógica, salvo que tenga productos activos o sea la única."""
        seccion = self._obtener(seccion_id)
        productos = self.secciones.contar_productos_activos(seccion.id)
        if productos > 0:
            raise ConflictError(
                f"No se puede eliminar la sección {seccion.nombre}: "
                f"tiene {productos} productos activos",
                "SECCION_CON_PRODUCTOS",
            )
        if self.secciones.contar_activas() <= 1:
            raise ConflictError(
                "No se puede eliminar la única sección activa de la carta",
                "SECCION_UNICA",
            )
        seccion.activo = False
        self.db.commit()

    def _obtener(self, seccion_id: int) -> SeccionCarta:
        seccion = self.secciones.obtener_activa(seccion_id)
        if seccion is None:
            raise NotFoundError("La sección no existe", "SECCION_NO_ENCONTRADA")
        return seccion

    def _validar_unica(self, nombre: str, excluir_id: int | None = None) -> None:
        if self.secciones.buscar_activa_por_nombre(nombre, excluir_id):
            raise ConflictError(
                "Ya existe una sección con ese nombre", "SECCION_DUPLICADA"
            )

    @staticmethod
    def _a_salida(seccion: SeccionCarta, cantidad: int) -> SeccionOut:
        return SeccionOut(
            id=seccion.id,
            nombre=seccion.nombre,
            orden=seccion.orden,
            cantidad_productos=cantidad,
        )


# Mensaje de duplicado de cada tipo de producto (HU-04a/b/c CA2).
MENSAJE_DUPLICADO = {
    TipoProducto.PLATO: "Ya existe un plato con ese nombre",
    TipoProducto.POSTRE: "Ya existe un postre con ese nombre",
    TipoProducto.BEBIDA: "Ya existe una bebida con ese nombre y volumen",
}


class ProductoService:
    """HU-04a a HU-04d: productos de la carta (plato, postre y bebida).

    La lógica es común a los tres tipos: cada tipo solo aporta su schema
    (con sus campos propios) y su mensaje de duplicado.
    """

    def __init__(self, db: Session):
        self.db = db
        self.productos = ProductoRepository(db)
        self.secciones = SeccionRepository(db)

    def listar(
        self, tipo: TipoProducto | None = None, seccion_id: int | None = None
    ) -> list[Producto]:
        """Productos activos para la administración, ordenados por nombre."""
        return self.productos.listar_activos(tipo, seccion_id)

    def obtener(self, producto_id: int, tipo: TipoProducto | None = None) -> Producto:
        """Producto activo; si se indica `tipo` y no coincide, también es 404."""
        producto = self.productos.obtener_activo(producto_id)
        if producto is None or (tipo is not None and producto.tipo != tipo):
            raise NotFoundError("El producto no existe", "PRODUCTO_NO_ENCONTRADO")
        return producto

    def crear(self, tipo: TipoProducto, datos: ProductoBase) -> Producto:
        """CA1 a CA4: alta de un producto activo y disponible, sin control de stock."""
        self._validar_seccion(datos.seccion_id)
        self._validar_unico(tipo, datos)
        producto = Producto(
            tipo=tipo, activo=True, disponible=True, stock=None, **datos.model_dump()
        )
        self.db.add(producto)
        self.db.commit()
        self.db.refresh(producto)
        return producto

    def modificar(
        self, producto_id: int, tipo: TipoProducto, datos: ProductoBase
    ) -> Producto:
        """CA5 y CA6: reemplaza los datos editables (precio, sección, ...).

        El precio de las comandas ya cargadas no cambia: queda guardado en
        `DetalleComanda.precio_unitario`.
        """
        producto = self.obtener(producto_id, tipo)
        self._validar_seccion(datos.seccion_id)
        self._validar_unico(tipo, datos, excluir_id=producto.id)
        for campo, valor in datos.model_dump().items():
            setattr(producto, campo, valor)
        self.db.commit()
        self.db.refresh(producto)
        return producto

    def eliminar(self, producto_id: int) -> None:
        """CA7 y CA8: baja lógica, salvo que el producto esté en uso."""
        producto = self.obtener(producto_id)
        motivos = self._motivos_en_uso(producto)
        if motivos:
            raise ConflictError(
                f"No se puede eliminar {producto.nombre}: {', '.join(motivos)}",
                "PRODUCTO_EN_USO",
            )
        producto.activo = False
        self.db.commit()

    def _motivos_en_uso(self, producto: Producto) -> list[str]:
        motivos = []
        comandas = self.productos.contar_comandas_abiertas(producto.id)
        if comandas > 0:
            motivos.append(f"está en {comandas} comandas abiertas")
        # TODO(HU-09b): menú ejecutivo o del día vigente
        # TODO(HU-09a): promoción vigente
        # TODO(HU-11a): menú acordado de una reserva activa
        return motivos

    def _validar_seccion(self, seccion_id: int) -> None:
        """CA4: tiene que haber secciones y la elegida tiene que estar activa."""
        if self.secciones.contar_activas() == 0:
            raise BusinessRuleError(
                "Primero tenés que crear una sección de la carta", "SIN_SECCIONES"
            )
        if self.secciones.obtener_activa(seccion_id) is None:
            raise BusinessRuleError(
                "La sección elegida no existe o fue eliminada", "SECCION_INVALIDA"
            )

    def _validar_unico(
        self, tipo: TipoProducto, datos: ProductoBase, excluir_id: int | None = None
    ) -> None:
        """CA2: nombre único entre los productos activos del mismo tipo.

        En las bebidas la unicidad es por nombre y volumen (HU-04c).
        """
        volumen_ml = getattr(datos, "volumen_ml", None)
        if self.productos.buscar_activo_por_nombre(
            tipo, datos.nombre, excluir_id, volumen_ml
        ):
            raise ConflictError(MENSAJE_DUPLICADO[tipo], "PRODUCTO_DUPLICADO")

    # --- Stock y disponibilidad (HU-04d) ---

    def cambiar_disponibilidad(self, producto_id: int, disponible: bool) -> Producto:
        """CA1 y CA2: marca manual de disponible / no disponible."""
        producto = self.obtener(producto_id)
        producto.disponible = disponible
        self.db.commit()
        return producto

    def cambiar_stock(self, producto_id: int, stock: int | None) -> Producto:
        """CA4 a CA6: carga, cambia o quita (`None`) el control de stock.

        Llegar a 0 no cambia la marca `disponible` (decisión C8): al reponer,
        el producto vuelve a estar disponible solo.
        """
        producto = self.obtener(producto_id)
        producto.stock = stock
        self.db.commit()
        return producto

    # Interfaz pública para HU-05 (comandas). No hacen commit: lo hace quien
    # los llama, dentro de su propia operación.

    def verificar_pedible(self, producto_id: int, cantidad: int) -> Producto:
        """Devuelve el producto si se puede agregar `cantidad` unidades a una comanda.

        Lanza NotFoundError (PRODUCTO_NO_ENCONTRADO) si no existe o fue eliminado,
        BusinessRuleError (PRODUCTO_NO_DISPONIBLE) si está marcado no disponible y
        BusinessRuleError (PRODUCTO_SIN_STOCK) si controla stock y no alcanza.
        No hace commit.
        """
        producto = self.obtener(producto_id)
        if not producto.disponible:
            raise BusinessRuleError(
                f"{producto.nombre} no está disponible", "PRODUCTO_NO_DISPONIBLE"
            )
        self._verificar_stock(producto, cantidad)
        return producto

    def descontar_stock(self, producto: Producto, cantidad: int) -> None:
        """Resta `cantidad` del stock si el producto lo controla (si no, no hace nada).

        Si no alcanza lanza PRODUCTO_SIN_STOCK (conviene llamar antes a
        `verificar_pedible`). No hace commit.
        """
        if producto.stock is None:
            return
        self._verificar_stock(producto, cantidad)
        producto.stock -= cantidad

    def reponer_stock(self, producto: Producto, cantidad: int) -> None:
        """Suma `cantidad` al stock si el producto lo controla. No hace commit."""
        if producto.stock is not None:
            producto.stock += cantidad

    @staticmethod
    def _verificar_stock(producto: Producto, cantidad: int) -> None:
        if producto.stock is not None and producto.stock < cantidad:
            raise BusinessRuleError(
                f"No hay stock suficiente de {producto.nombre} "
                f"(quedan {producto.stock})",
                "PRODUCTO_SIN_STOCK",
            )
