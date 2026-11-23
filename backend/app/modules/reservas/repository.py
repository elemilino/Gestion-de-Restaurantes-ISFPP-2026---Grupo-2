"""Consultas de reservas (HU-11a y HU-11b)."""

from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import EstadoReserva
from app.models.carta import Producto
from app.models.clientes import Cliente
from app.models.comandas import Comanda
from app.models.medios_pago import MedioPago
from app.models.personal import Mozo
from app.models.reservas import MenuAcordado, Reserva, reserva_mesa
from app.models.salon import Mesa


class ReservaRepository:
    def __init__(self, db: Session):
        self.db = db

    def _consulta(self):
        return select(Reserva).options(
            selectinload(Reserva.mesas),
            selectinload(Reserva.cliente),
            selectinload(Reserva.sena),
            selectinload(Reserva.menu_acordado).selectinload(MenuAcordado.detalles),
            selectinload(Reserva.comanda),
        )

    def obtener(self, reserva_id: int) -> Reserva | None:
        return self.db.scalars(self._consulta().where(Reserva.id == reserva_id)).first()

    def listar(
        self,
        fecha: date | None,
        estado: EstadoReserva | None,
        cliente_id: int | None,
        sin_comanda: bool | None,
    ) -> list[Reserva]:
        consulta = self._consulta()
        if fecha is not None:
            desde = datetime.combine(fecha, time.min)
            consulta = consulta.where(
                Reserva.fecha_hora >= desde,
                Reserva.fecha_hora < desde + timedelta(days=1),
            )
        if estado is not None:
            consulta = consulta.where(Reserva.estado == estado)
        if cliente_id is not None:
            consulta = consulta.where(Reserva.cliente_id == cliente_id)
        if sin_comanda:
            con_comanda = select(Comanda.reserva_id).where(
                Comanda.reserva_id.is_not(None)
            )
            consulta = consulta.where(Reserva.id.not_in(con_comanda))
        return list(self.db.scalars(consulta.order_by(Reserva.fecha_hora, Reserva.id)))

    def activas_en_mesas(
        self, mesa_ids: list[int], excluir_id: int | None = None
    ) -> list[Reserva]:
        """Reservas ACTIVAS que usan alguna de las mesas (para ver superposición)."""
        consulta = (
            select(Reserva)
            .options(selectinload(Reserva.mesas))
            .join(reserva_mesa, reserva_mesa.c.reserva_id == Reserva.id)
            .where(
                reserva_mesa.c.mesa_id.in_(mesa_ids),
                Reserva.estado == EstadoReserva.ACTIVA,
            )
            .distinct()
        )
        if excluir_id is not None:
            consulta = consulta.where(Reserva.id != excluir_id)
        return list(self.db.scalars(consulta))

    def buscar_mesas(self, numeros: list[int]) -> list[Mesa]:
        consulta = select(Mesa).where(Mesa.numero.in_(numeros), Mesa.activo)
        return list(self.db.scalars(consulta))

    def buscar_cliente(self, cliente_id: int) -> Cliente | None:
        return self.db.get(Cliente, cliente_id)

    def buscar_medio_pago(self, medio_pago_id: int) -> MedioPago | None:
        return self.db.get(MedioPago, medio_pago_id)

    def buscar_producto(self, producto_id: int) -> Producto | None:
        return self.db.get(Producto, producto_id)

    def marcar_vencidas_ausentes(self, ahora: datetime | None = None) -> int:
        """Pasa a AUSENTE toda reserva ACTIVA cuya fecha y hora límite ya se alcanzó."""
        limite = ahora or datetime.now()
        vencidas = list(
            self.db.scalars(
                select(Reserva).where(
                    Reserva.estado == EstadoReserva.ACTIVA,
                    Reserva.fecha_hora <= limite,
                )
            )
        )
        if not vencidas:
            return 0
        for r in vencidas:
            r.estado = EstadoReserva.AUSENTE
        self.db.commit()
        return len(vencidas)

    def obtener_mozo_para_mesas(self, mesas: list[Mesa]) -> Mozo:
        """Busca un mozo activo del sector de las mesas (o de cualquier sector)."""
        sector_id = mesas[0].sector_id
        mozo = self.db.scalars(
            select(Mozo)
            .where(Mozo.activo, Mozo.sector_id == sector_id)
            .order_by(Mozo.id)
        ).first()
        if mozo is not None:
            return mozo
        mozo = self.db.scalars(
            select(Mozo).where(Mozo.activo).order_by(Mozo.id)
        ).first()
        if mozo is not None:
            return mozo
        mozo = Mozo(
            dni="00000001",
            nombre="Mozo",
            apellido="Salón",
            sector_id=sector_id,
            activo=True,
        )
        self.db.add(mozo)
        self.db.flush()
        return mozo

    def guardar(self, reserva: Reserva) -> Reserva:
        self.db.add(reserva)
        self.db.commit()
        # Se relee de la base para devolver los montos como quedaron guardados.
        self.db.expire_all()
        return self.obtener(reserva.id)
