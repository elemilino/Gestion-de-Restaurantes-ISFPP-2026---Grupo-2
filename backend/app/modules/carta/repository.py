"""Acceso a datos del módulo carta: solo consultas, sin reglas de negocio.

Nota: el `lower()` de SQLite solo pasa a minúsculas las letras ASCII ("Ñ" queda
"Ñ"), así que la comparación de nombres sin mayúsculas y el orden alfabético se
terminan de hacer en Python (las tablas de la carta son chicas).
"""

import unicodedata

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import EstadoComanda, TipoProducto
from app.models.carta import Producto, SeccionCarta
from app.models.comandas import Comanda, DetalleComanda


def clave_nombre(texto: str) -> tuple[str, str]:
    """Clave para ordenar nombres en español: sin mayúsculas ni tildes (ñ junto a n)."""
    minusculas = texto.casefold()
    descompuesto = unicodedata.normalize("NFD", minusculas)
    sin_tildes = "".join(c for c in descompuesto if not unicodedata.combining(c))
    return sin_tildes, minusculas


def _mismo_nombre(a: str, b: str) -> bool:
    return a.casefold() == b.casefold()


class SeccionRepository:
    def __init__(self, db: Session):
        self.db = db

    def obtener_activa(self, seccion_id: int) -> SeccionCarta | None:
        seccion = self.db.get(SeccionCarta, seccion_id)
        return seccion if seccion is not None and seccion.activo else None

    def listar_activas(self) -> list[SeccionCarta]:
        """Secciones activas ordenadas por `orden` y después por nombre."""
        consulta = select(SeccionCarta).where(SeccionCarta.activo)
        return sorted(
            self.db.scalars(consulta), key=lambda s: (s.orden, clave_nombre(s.nombre))
        )

    def listar_activas_con_cantidad(self) -> list[tuple[SeccionCarta, int]]:
        """Secciones activas en orden, con su cantidad de productos activos."""
        cantidades = (
            select(Producto.seccion_id, func.count(Producto.id).label("cantidad"))
            .where(Producto.activo)
            .group_by(Producto.seccion_id)
            .subquery()
        )
        consulta = (
            select(SeccionCarta, func.coalesce(cantidades.c.cantidad, 0))
            .outerjoin(cantidades, cantidades.c.seccion_id == SeccionCarta.id)
            .where(SeccionCarta.activo)
        )
        filas = [(seccion, cantidad) for seccion, cantidad in self.db.execute(consulta)]
        return sorted(filas, key=lambda f: (f[0].orden, clave_nombre(f[0].nombre)))

    def buscar_activa_por_nombre(
        self, nombre: str, excluir_id: int | None = None
    ) -> SeccionCarta | None:
        """Sección activa con ese nombre, sin distinguir mayúsculas."""
        consulta = select(SeccionCarta).where(
            SeccionCarta.activo, func.length(SeccionCarta.nombre) == len(nombre)
        )
        if excluir_id is not None:
            consulta = consulta.where(SeccionCarta.id != excluir_id)
        return next(
            (s for s in self.db.scalars(consulta) if _mismo_nombre(s.nombre, nombre)),
            None,
        )

    def contar_activas(self) -> int:
        consulta = select(func.count(SeccionCarta.id)).where(SeccionCarta.activo)
        return self.db.scalar(consulta) or 0

    def max_orden(self) -> int:
        consulta = select(func.max(SeccionCarta.orden)).where(SeccionCarta.activo)
        return self.db.scalar(consulta) or 0

    def contar_productos_activos(self, seccion_id: int) -> int:
        consulta = select(func.count(Producto.id)).where(
            Producto.activo, Producto.seccion_id == seccion_id
        )
        return self.db.scalar(consulta) or 0


class ProductoRepository:
    def __init__(self, db: Session):
        self.db = db

    def obtener_activo(self, producto_id: int) -> Producto | None:
        producto = self.db.get(Producto, producto_id)
        return producto if producto is not None and producto.activo else None

    def listar_activos(
        self, tipo: TipoProducto | None = None, seccion_id: int | None = None
    ) -> list[Producto]:
        consulta = select(Producto).where(Producto.activo)
        if tipo is not None:
            consulta = consulta.where(Producto.tipo == tipo)
        if seccion_id is not None:
            consulta = consulta.where(Producto.seccion_id == seccion_id)
        return sorted(self.db.scalars(consulta), key=lambda p: clave_nombre(p.nombre))

    def buscar_activo_por_nombre(
        self, tipo: TipoProducto, nombre: str, excluir_id: int | None = None
    ) -> Producto | None:
        """Producto activo del mismo tipo y nombre (sin distinguir mayúsculas)."""
        consulta = select(Producto).where(
            Producto.activo,
            Producto.tipo == tipo,
            func.length(Producto.nombre) == len(nombre),
        )
        if excluir_id is not None:
            consulta = consulta.where(Producto.id != excluir_id)
        return next(
            (p for p in self.db.scalars(consulta) if _mismo_nombre(p.nombre, nombre)),
            None,
        )

    def contar_comandas_abiertas(self, producto_id: int) -> int:
        """Cantidad de comandas ABIERTAS distintas que tienen el producto."""
        consulta = (
            select(func.count(func.distinct(Comanda.id)))
            .join(DetalleComanda, DetalleComanda.comanda_id == Comanda.id)
            .where(
                DetalleComanda.producto_id == producto_id,
                Comanda.estado == EstadoComanda.ABIERTA,
            )
        )
        return self.db.scalar(consulta) or 0
