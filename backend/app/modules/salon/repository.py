"""Acceso a datos del módulo salón: solo consultas, sin reglas de negocio.

Nota: el `lower()` de SQLite solo pasa a minúsculas las letras ASCII, así que la
comparación de nombres sin mayúsculas y el orden alfabético se hacen en Python
(las tablas del salón son chicas).
"""

from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.enums import EstadoComanda, EstadoReserva
from app.models.comandas import Comanda
from app.models.reservas import Reserva, reserva_mesa
from app.models.salon import Mesa, Sector


class SectorRepository:
    def __init__(self, db: Session):
        self.db = db

    def obtener_activo(self, sector_id: int) -> Sector | None:
        sector = self.db.get(Sector, sector_id)
        return sector if sector is not None and sector.activo else None

    def listar_activos_con_cantidad(self) -> list[tuple[Sector, int]]:
        """Sectores activos ordenados por nombre, con su cantidad de mesas activas."""
        cantidades = (
            select(Mesa.sector_id, func.count(Mesa.id).label("cantidad"))
            .where(Mesa.activo)
            .group_by(Mesa.sector_id)
            .subquery()
        )
        consulta = (
            select(Sector, func.coalesce(cantidades.c.cantidad, 0))
            .outerjoin(cantidades, cantidades.c.sector_id == Sector.id)
            .where(Sector.activo)
        )
        filas = [(sector, cantidad) for sector, cantidad in self.db.execute(consulta)]
        return sorted(filas, key=lambda f: f[0].nombre.casefold())

    def buscar_activo_por_nombre(
        self, nombre: str, excluir_id: int | None = None
    ) -> Sector | None:
        """Sector activo con ese nombre, sin distinguir mayúsculas."""
        consulta = select(Sector).where(
            Sector.activo, func.length(Sector.nombre) == len(nombre)
        )
        if excluir_id is not None:
            consulta = consulta.where(Sector.id != excluir_id)
        return next(
            (
                s
                for s in self.db.scalars(consulta)
                if s.nombre.casefold() == nombre.casefold()
            ),
            None,
        )

    def contar_mesas_activas(self, sector_id: int) -> int:
        consulta = select(func.count(Mesa.id)).where(
            Mesa.activo, Mesa.sector_id == sector_id
        )
        return self.db.scalar(consulta) or 0


class MesaRepository:
    def __init__(self, db: Session):
        self.db = db

    def obtener_activa(self, mesa_id: int) -> Mesa | None:
        mesa = self.db.get(Mesa, mesa_id)
        return mesa if mesa is not None and mesa.activo else None

    def listar_activas(self, sector_id: int | None = None) -> list[Mesa]:
        """Mesas activas ordenadas por número (con su sector ya cargado)."""
        consulta = (
            select(Mesa)
            .options(joinedload(Mesa.sector))
            .where(Mesa.activo)
            .order_by(Mesa.numero)
        )
        if sector_id is not None:
            consulta = consulta.where(Mesa.sector_id == sector_id)
        return list(self.db.scalars(consulta))

    def buscar_activa_por_numero(
        self, numero: int, excluir_id: int | None = None
    ) -> Mesa | None:
        consulta = select(Mesa).where(Mesa.activo, Mesa.numero == numero)
        if excluir_id is not None:
            consulta = consulta.where(Mesa.id != excluir_id)
        return self.db.scalars(consulta).first()

    # Comandas abiertas. Si se integra el modelo de `feature/comanda` (comanda con
    # varias mesas y `fecha_hora_cierre`), solo hay que cambiar estas dos consultas.

    def comandas_abiertas(self, mesa_id: int) -> list[Comanda]:
        consulta = select(Comanda).where(
            Comanda.mesa_id == mesa_id, Comanda.estado == EstadoComanda.ABIERTA
        )
        return list(self.db.scalars(consulta))

    def ids_con_comanda_abierta(self, mesa_ids: list[int]) -> set[int]:
        if not mesa_ids:
            return set()
        consulta = select(Comanda.mesa_id).where(
            Comanda.mesa_id.in_(mesa_ids), Comanda.estado == EstadoComanda.ABIERTA
        )
        return set(self.db.scalars(consulta))

    # Reservas activas (HU-11a).

    def reservas_activas(self, mesa_id: int) -> list[Reserva]:
        """Reservas activas que incluyen la mesa, con todas sus mesas cargadas."""
        consulta = (
            select(Reserva)
            .options(selectinload(Reserva.mesas))
            .join(reserva_mesa, reserva_mesa.c.reserva_id == Reserva.id)
            .where(
                reserva_mesa.c.mesa_id == mesa_id,
                Reserva.estado == EstadoReserva.ACTIVA,
            )
            .order_by(Reserva.fecha_hora)
        )
        return list(self.db.scalars(consulta))

    def ids_reservadas_el_dia(self, mesa_ids: list[int], dia: date) -> set[int]:
        """Mesas (de `mesa_ids`) con una reserva activa en ese día."""
        if not mesa_ids:
            return set()
        desde = datetime.combine(dia, time.min)
        consulta = (
            select(reserva_mesa.c.mesa_id)
            .join(Reserva, Reserva.id == reserva_mesa.c.reserva_id)
            .where(
                reserva_mesa.c.mesa_id.in_(mesa_ids),
                Reserva.estado == EstadoReserva.ACTIVA,
                Reserva.fecha_hora >= desde,
                Reserva.fecha_hora < desde + timedelta(days=1),
            )
        )
        return set(self.db.scalars(consulta))
