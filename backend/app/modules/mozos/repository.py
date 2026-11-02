"""Acceso a datos del módulo mozos: consultas con SQLAlchemy."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.comandas import Comanda
from app.models.personal import Mozo
from app.models.salon import Mesa, Sector
from app.models.usuario import Usuario


class MozoRepository:
    def __init__(self, db: Session):
        self.db = db

    def listar_activos(self) -> list[Mozo]:
        consulta = (
            select(Mozo)
            .options(joinedload(Mozo.sector), joinedload(Mozo.usuario))
            .where(Mozo.activo)
            .order_by(Mozo.apellido, Mozo.nombre)
        )
        return list(self.db.scalars(consulta).unique())

    def buscar_por_id(self, mozo_id: int) -> Mozo | None:
        consulta = (
            select(Mozo)
            .options(joinedload(Mozo.sector), joinedload(Mozo.usuario))
            .where(Mozo.id == mozo_id)
        )
        return self.db.scalars(consulta).unique().first()

    def buscar_activo_por_id(self, mozo_id: int) -> Mozo | None:
        consulta = (
            select(Mozo)
            .options(joinedload(Mozo.sector), joinedload(Mozo.usuario))
            .where(Mozo.id == mozo_id, Mozo.activo)
        )
        return self.db.scalars(consulta).unique().first()

    def buscar_activo_por_dni(self, dni: str) -> Mozo | None:
        consulta = select(Mozo).where(Mozo.activo, Mozo.dni == dni)
        return self.db.scalars(consulta).first()

    def buscar_por_usuario_id(self, usuario_id: int) -> Mozo | None:
        consulta = (
            select(Mozo)
            .options(joinedload(Mozo.sector), joinedload(Mozo.usuario))
            .where(Mozo.usuario_id == usuario_id, Mozo.activo)
        )
        return self.db.scalars(consulta).unique().first()

    def buscar_sector_activo(self, sector_id: int) -> Sector | None:
        consulta = select(Sector).where(Sector.id == sector_id, Sector.activo)
        return self.db.scalars(consulta).first()

    def listar_sectores_activos(self) -> list[Sector]:
        consulta = select(Sector).where(Sector.activo).order_by(Sector.nombre)
        return list(self.db.scalars(consulta))

    def buscar_mesa_activa(self, mesa_id: int) -> Mesa | None:
        consulta = (
            select(Mesa)
            .options(joinedload(Mesa.sector))
            .where(Mesa.id == mesa_id, Mesa.activo)
        )
        return self.db.scalars(consulta).first()

    def contar_comandas_activas(self, mozo_id: int) -> int:
        """Cuenta comandas en estado ABIERTA asignadas a este mozo.

        (CA3 y Decisión D1).
        """
        consulta = select(func.count(Comanda.id)).where(
            Comanda.mozo_id == mozo_id,
            Comanda.fecha_hora_cierre.is_(None),
        )
        return self.db.scalar(consulta) or 0

    def buscar_comandas_activas(self, mozo_id: int) -> list[Comanda]:
        consulta = select(Comanda).where(
            Comanda.mozo_id == mozo_id,
            Comanda.fecha_hora_cierre.is_(None),
        )
        return list(self.db.scalars(consulta))

    def buscar_usuario_por_username(self, username: str) -> Usuario | None:
        consulta = select(Usuario).where(Usuario.username == username)
        return self.db.scalars(consulta).first()
