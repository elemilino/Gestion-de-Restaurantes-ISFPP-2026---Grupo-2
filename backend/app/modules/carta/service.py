"""Reglas de negocio del módulo carta. No conoce HTTP: lanza errores de dominio."""

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.carta import SeccionCarta
from app.modules.carta.repository import SeccionRepository
from app.modules.carta.schemas import SeccionCreate, SeccionOut, SeccionUpdate


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
