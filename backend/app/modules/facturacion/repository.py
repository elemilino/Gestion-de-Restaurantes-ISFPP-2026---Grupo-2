"""Acceso a datos del módulo facturación: consultas con SQLAlchemy."""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import EstadoComanda
from app.models.comandas import Comanda, DetalleComanda
from app.models.facturacion import DetallePago, Factura
from app.models.medios_pago import MedioPago
from app.models.reservas import Reserva


class FacturacionRepository:
    def __init__(self, db: Session):
        self.db = db

    def buscar_factura_por_id(self, factura_id: int) -> Factura | None:
        consulta = (
            select(Factura)
            .options(
                selectinload(Factura.detalles_pago).selectinload(
                    DetallePago.medio_pago
                ),
                selectinload(Factura.comanda)
                .selectinload(Comanda.detalles)
                .selectinload(DetalleComanda.producto),
                selectinload(Factura.comanda).selectinload(Comanda.mesas),
                selectinload(Factura.comanda).selectinload(Comanda.mozo),
                selectinload(Factura.comanda)
                .selectinload(Comanda.reserva)
                .selectinload(Reserva.sena),
            )
            .where(Factura.id == factura_id)
        )
        return self.db.scalars(consulta).first()

    def buscar_factura_por_comanda_id(self, comanda_id: int) -> Factura | None:
        consulta = select(Factura).where(Factura.comanda_id == comanda_id)
        return self.db.scalars(consulta).first()

    def listar_facturas(self) -> list[Factura]:
        consulta = (
            select(Factura)
            .options(
                selectinload(Factura.detalles_pago).selectinload(
                    DetallePago.medio_pago
                ),
                selectinload(Factura.comanda)
                .selectinload(Comanda.reserva)
                .selectinload(Reserva.sena),
            )
            .order_by(Factura.fecha.desc())
        )
        return list(self.db.scalars(consulta))

    def comandas_por_facturar(self) -> list[Comanda]:
        """Comandas CERRADAS sin factura, de la más vieja a la más nueva."""
        consulta = (
            select(Comanda)
            .options(
                selectinload(Comanda.detalles),
                selectinload(Comanda.mesas),
                selectinload(Comanda.mozo),
            )
            .outerjoin(Factura, Factura.comanda_id == Comanda.id)
            .where(Comanda.estado == EstadoComanda.CERRADA, Factura.id.is_(None))
            .order_by(Comanda.fecha_hora_cierre)
        )
        return list(self.db.scalars(consulta))

    def buscar_comanda(self, comanda_id: int) -> Comanda | None:
        consulta = (
            select(Comanda)
            .options(
                selectinload(Comanda.detalles).selectinload(DetalleComanda.producto),
                selectinload(Comanda.mesas),
                selectinload(Comanda.mozo),
                selectinload(Comanda.reserva).selectinload(Reserva.sena),
            )
            .where(Comanda.id == comanda_id)
        )
        return self.db.scalars(consulta).first()

    def buscar_medio_pago(self, medio_id: int) -> MedioPago | None:
        return self.db.get(MedioPago, medio_id)
