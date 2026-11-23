"""Acceso a datos del módulo promociones: solo consultas."""

from datetime import date

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.carta import Producto
from app.models.promociones import Promocion, promocion_producto


class PromocionRepository:
    def __init__(self, db: Session):
        self.db = db

    def listar(self) -> list[Promocion]:
        consulta = select(Promocion).order_by(
            Promocion.fecha_inicio.desc(), Promocion.id.desc()
        )
        return list(self.db.scalars(consulta))

    def buscar_por_id(self, promocion_id: int) -> Promocion | None:
        return self.db.get(Promocion, promocion_id)

    def buscar_productos(self, producto_ids: list[int]) -> list[Producto]:
        if not producto_ids:
            return []
        consulta = select(Producto).where(Producto.id.in_(producto_ids))
        return list(self.db.scalars(consulta))

    def buscar_superpuesta(
        self,
        producto_ids: list[int],
        fecha_inicio: date,
        fecha_fin: date,
        excluir_id: int | None = None,
    ) -> Promocion | None:
        """Promoción activa que comparte algún producto y se superpone en fechas."""
        if not producto_ids:
            return None
        consulta = (
            select(Promocion)
            .join(
                promocion_producto,
                promocion_producto.c.promocion_id == Promocion.id,
            )
            .where(
                Promocion.activo,
                promocion_producto.c.producto_id.in_(producto_ids),
                Promocion.fecha_inicio <= fecha_fin,
                Promocion.fecha_fin >= fecha_inicio,
            )
        )
        if excluir_id is not None:
            consulta = consulta.where(Promocion.id != excluir_id)
        return self.db.scalars(consulta).first()

    def buscar_vigente_por_producto(
        self, producto_id: int, fecha: date | None = None
    ) -> Promocion | None:
        """Promoción activa que incluye el producto en la fecha indicada."""
        hoy = fecha or date.today()
        consulta = (
            select(Promocion)
            .join(
                promocion_producto,
                promocion_producto.c.promocion_id == Promocion.id,
            )
            .where(
                Promocion.activo,
                promocion_producto.c.producto_id == producto_id,
                Promocion.fecha_inicio <= hoy,
                Promocion.fecha_fin >= hoy,
            )
            .order_by(Promocion.descuento.desc(), Promocion.id.desc())
        )
        return self.db.scalars(consulta).first()

    def promociones_vigentes_por_producto(
        self, producto_ids: list[int], fecha: date | None = None
    ) -> dict[int, Promocion]:
        """Mapa {producto_id: Promocion} para los productos con promoción vigente."""
        if not producto_ids:
            return {}
        hoy = fecha or date.today()
        consulta = (
            select(promocion_producto.c.producto_id, Promocion)
            .join(
                Promocion,
                Promocion.id == promocion_producto.c.promocion_id,
            )
            .where(
                Promocion.activo,
                promocion_producto.c.producto_id.in_(producto_ids),
                Promocion.fecha_inicio <= hoy,
                Promocion.fecha_fin >= hoy,
            )
            .order_by(Promocion.descuento.desc(), Promocion.id.desc())
        )
        mapa: dict[int, Promocion] = {}
        for prod_id, promo in self.db.execute(consulta):
            mapa.setdefault(prod_id, promo)
        return mapa

    def desactivar_expiradas(self, hoy: date) -> int:
        """Baja lógica automática de las promociones cuya fecha_fin ya pasó."""
        resultado = self.db.execute(
            update(Promocion)
            .where(Promocion.activo, Promocion.fecha_fin < hoy)
            .values(activo=False)
        )
        return resultado.rowcount or 0
