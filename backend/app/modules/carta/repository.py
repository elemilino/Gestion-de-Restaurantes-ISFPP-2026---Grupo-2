"""Acceso a datos del módulo carta: solo consultas, sin reglas de negocio."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.carta import Producto, SeccionCarta


class SeccionRepository:
    def __init__(self, db: Session):
        self.db = db

    def obtener_activa(self, seccion_id: int) -> SeccionCarta | None:
        seccion = self.db.get(SeccionCarta, seccion_id)
        return seccion if seccion is not None and seccion.activo else None

    def listar_activas(self) -> list[SeccionCarta]:
        consulta = (
            select(SeccionCarta)
            .where(SeccionCarta.activo)
            .order_by(SeccionCarta.orden, SeccionCarta.nombre)
        )
        return list(self.db.scalars(consulta))

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
            .order_by(SeccionCarta.orden, SeccionCarta.nombre)
        )
        return [(seccion, cantidad) for seccion, cantidad in self.db.execute(consulta)]

    def buscar_activa_por_nombre(
        self, nombre: str, excluir_id: int | None = None
    ) -> SeccionCarta | None:
        consulta = select(SeccionCarta).where(
            SeccionCarta.activo, func.lower(SeccionCarta.nombre) == nombre.lower()
        )
        if excluir_id is not None:
            consulta = consulta.where(SeccionCarta.id != excluir_id)
        return self.db.scalars(consulta).first()

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
