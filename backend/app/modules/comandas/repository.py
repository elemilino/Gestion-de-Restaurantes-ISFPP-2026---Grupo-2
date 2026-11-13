from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from datetime import date, datetime, time, timedelta
from app.core.enums import EstadoComanda, EstadoReserva
from app.models.comandas import Comanda, comanda_mesa
from app.models.personal import Mozo
from app.models.reservas import Reserva, reserva_mesa
from app.models.salon import Mesa
from app.models.carta import Producto


class ComandaRepository:
    def __init__(self, db: Session):
        self.db = db

    def buscar_mozo_por_dni(self, dni: str) -> Mozo | None:
        consulta = select(Mozo).where(Mozo.dni == dni)
        return self.db.scalars(consulta).first()

    def buscar_mesas_por_numeros(self, numeros: list[int]) -> list[Mesa]:
        consulta = select(Mesa).where(Mesa.numero.in_(numeros))
        return list(self.db.scalars(consulta))

    def numeros_de_mesas_ocupadas(self, mesas: list[Mesa]) -> list[int]:
        """Mesas con una comanda en curso (abierta o cerrada sin cobrar).

        La mesa se libera cuando la comanda pasa a FACTURADA o ANULADA.
        """
        consulta = (
            select(Mesa.numero)
            .join(comanda_mesa, comanda_mesa.c.mesa_id == Mesa.id)
            .join(Comanda, Comanda.id == comanda_mesa.c.comanda_id)
            .where(
                Mesa.id.in_([m.id for m in mesas]),
                Comanda.estado.in_([EstadoComanda.ABIERTA, EstadoComanda.CERRADA]),
            )
        )
        return sorted(self.db.scalars(consulta))

    def guardar(self, comanda: Comanda) -> Comanda:
        self.db.add(comanda)
        self.db.commit()
        self.db.refresh(comanda)
        return comanda

    # HU-05b
    def buscar_comanda(self, comanda_id: int) -> Comanda | None:
        return self.db.get(Comanda, comanda_id)

    def buscar_producto(self, producto_id: int) -> Producto | None:
        return self.db.get(Producto, producto_id)

    #
    # HU-05e
    def eliminar(self, comanda: Comanda) -> None:
        self.db.delete(comanda)
        self.db.commit()

    # HU-05f
    def listar(
        self,
        mozo_id: int | None,
        desde: date | None,
        hasta: date | None,
        abierta: bool | None,
    ) -> list[Comanda]:
        consulta = select(Comanda).order_by(Comanda.fecha_hora_apertura.desc())
        if mozo_id is not None:
            consulta = consulta.where(Comanda.mozo_id == mozo_id)
        if desde is not None:
            consulta = consulta.where(
                Comanda.fecha_hora_apertura >= datetime.combine(desde, time.min)
            )
        if hasta is not None:
            consulta = consulta.where(
                Comanda.fecha_hora_apertura <= datetime.combine(hasta, time.max)
            )
        if abierta is True:
            consulta = consulta.where(Comanda.estado == EstadoComanda.ABIERTA)
        elif abierta is False:
            consulta = consulta.where(Comanda.estado != EstadoComanda.ABIERTA)
        return list(self.db.scalars(consulta))

    # HU-06: Tablero operativo de mesas
    def listar_mesas_activas(self) -> list[Mesa]:
        consulta = (
            select(Mesa)
            .options(joinedload(Mesa.sector))
            .where(Mesa.activo)
            .order_by(Mesa.numero)
        )
        return list(self.db.scalars(consulta))

    def comandas_en_curso(self) -> list[Comanda]:
        consulta = (
            select(Comanda)
            .where(Comanda.estado.in_([EstadoComanda.ABIERTA, EstadoComanda.CERRADA]))
            .order_by(Comanda.fecha_hora_apertura.desc())
        )
        return list(self.db.scalars(consulta))

    def ids_mesas_reservadas_hoy(self, mesa_ids: list[int]) -> set[int]:
        if not mesa_ids:
            return set()
        hoy = date.today()
        desde = datetime.combine(hoy, time.min)
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
