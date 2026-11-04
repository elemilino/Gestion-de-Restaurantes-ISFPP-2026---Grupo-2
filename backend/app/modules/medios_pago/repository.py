"""Acceso a datos del módulo medios_pago: consultas con SQLAlchemy."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.medios_pago import MedioPago


class MedioPagoRepository:
    def __init__(self, db: Session):
        self.db = db

    def listar(self, solo_activos: bool = False) -> list[MedioPago]:
        consulta = select(MedioPago)
        if solo_activos:
            consulta = consulta.where(MedioPago.activo)
        consulta = consulta.order_by(MedioPago.nombre)
        return list(self.db.scalars(consulta))

    def buscar_por_id(self, medio_id: int) -> MedioPago | None:
        return self.db.get(MedioPago, medio_id)

    def buscar_por_nombre(
        self, nombre: str, excluir_id: int | None = None
    ) -> MedioPago | None:
        consulta = select(MedioPago).where(
            func.lower(func.trim(MedioPago.nombre)) == func.lower(func.trim(nombre))
        )
        if excluir_id is not None:
            consulta = consulta.where(MedioPago.id != excluir_id)
        return self.db.scalars(consulta).first()
