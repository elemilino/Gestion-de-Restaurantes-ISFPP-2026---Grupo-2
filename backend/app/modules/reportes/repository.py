"""Consultas de los reportes: agregaciones hechas en la base (riesgo T05).

Todas reciben el rango como [inicio, fin): inicio a las 00:00 del primer día y
fin a las 00:00 del día siguiente al último.
"""

from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import EstadoComanda, EstadoFactura, EstadoReserva, TipoProducto
from app.models.carta import Producto, SeccionCarta
from app.models.clientes import Cliente
from app.models.comandas import Comanda, DetalleComanda, comanda_mesa
from app.models.facturacion import DetallePago, Factura
from app.models.medios_pago import MedioPago
from app.models.personal import Mozo
from app.models.reservas import Reserva, Sena
from app.models.salon import Mesa

CERRADAS = (EstadoComanda.CERRADA, EstadoComanda.FACTURADA)


class ReporteRepository:
    def __init__(self, db: Session):
        self.db = db

    # --- HU-12a ---
    def facturas_pagadas_por_dia(self, inicio: datetime, fin: datetime) -> list:
        dia = func.date(Factura.fecha)
        consulta = (
            select(dia, func.sum(Factura.importe_total), func.count(Factura.id))
            .where(
                Factura.estado == EstadoFactura.PAGADA,
                Factura.fecha >= inicio,
                Factura.fecha < fin,
            )
            .group_by(dia)
        )
        return list(self.db.execute(consulta))

    def pendiente_de_cobro(self, inicio: datetime, fin: datetime):
        consulta = select(func.sum(Factura.importe_total)).where(
            Factura.estado == EstadoFactura.ADEUDADA,
            Factura.fecha >= inicio,
            Factura.fecha < fin,
        )
        return self.db.scalar(consulta)

    # --- HU-12b ---
    def productos_vendidos(
        self,
        inicio: datetime,
        fin: datetime,
        tipo: TipoProducto | None,
        seccion_id: int | None,
    ) -> list:
        unidades = func.sum(DetalleComanda.cantidad)
        importe = func.sum(DetalleComanda.cantidad * DetalleComanda.precio_unitario)
        consulta = (
            select(
                Producto.id,
                Producto.nombre,
                Producto.tipo,
                SeccionCarta.nombre,
                Producto.activo,
                unidades,
                importe,
            )
            .join(DetalleComanda, DetalleComanda.producto_id == Producto.id)
            .join(Comanda, Comanda.id == DetalleComanda.comanda_id)
            .join(Factura, Factura.comanda_id == Comanda.id)
            .join(SeccionCarta, SeccionCarta.id == Producto.seccion_id)
            .where(
                Comanda.estado == EstadoComanda.FACTURADA,
                Factura.estado == EstadoFactura.PAGADA,
                Factura.fecha >= inicio,
                Factura.fecha < fin,
            )
            .group_by(Producto.id)
        )
        if tipo is not None:
            consulta = consulta.where(Producto.tipo == tipo)
        if seccion_id is not None:
            consulta = consulta.where(Producto.seccion_id == seccion_id)
        return list(self.db.execute(consulta))

    # --- HU-12c ---
    def ventas_por_mozo(
        self, inicio: datetime, fin: datetime, mozo_id: int | None
    ) -> list:
        facturado = func.sum(
            case(
                (Factura.estado == EstadoFactura.PAGADA, Factura.importe_total),
                else_=0,
            )
        )
        consulta = (
            select(
                Mozo,
                func.count(Comanda.id),
                func.sum(Comanda.cantidad_comensales),
                facturado,
            )
            .join(Comanda, Comanda.mozo_id == Mozo.id)
            .outerjoin(Factura, Factura.comanda_id == Comanda.id)
            .where(
                Comanda.estado.in_(CERRADAS),
                Comanda.fecha_hora_cierre >= inicio,
                Comanda.fecha_hora_cierre < fin,
            )
            .group_by(Mozo.id)
        )
        if mozo_id is not None:
            consulta = consulta.where(Mozo.id == mozo_id)
        return list(self.db.execute(consulta))

    def comandas_cerradas_de(
        self, mozo_id: int, inicio: datetime, fin: datetime
    ) -> list[Comanda]:
        consulta = (
            select(Comanda)
            .options(selectinload(Comanda.mesas), selectinload(Comanda.detalles))
            .where(
                Comanda.mozo_id == mozo_id,
                Comanda.estado.in_(CERRADAS),
                Comanda.fecha_hora_cierre >= inicio,
                Comanda.fecha_hora_cierre < fin,
            )
            .order_by(Comanda.fecha_hora_cierre)
        )
        return list(self.db.scalars(consulta))

    def buscar_mozo_por_dni(self, dni: str) -> Mozo | None:
        return self.db.scalars(select(Mozo).where(Mozo.dni == dni)).first()

    # --- HU-12d ---
    def contar_mesas_activas(self, sector_id: int | None) -> int:
        consulta = select(func.count(Mesa.id)).where(Mesa.activo)
        if sector_id is not None:
            consulta = consulta.where(Mesa.sector_id == sector_id)
        return self.db.scalar(consulta) or 0

    def intervalos_de_mesas(
        self, inicio: datetime, fin: datetime, sector_id: int | None
    ) -> list:
        """(apertura, cierre, mesa_id) de cada mesa de cada comanda del período.

        Cierre vacío = comanda abierta (cuenta hasta ahora, CA4).
        """
        consulta = (
            select(Comanda.fecha_hora_apertura, Comanda.fecha_hora_cierre, Mesa.id)
            .join(comanda_mesa, comanda_mesa.c.comanda_id == Comanda.id)
            .join(Mesa, Mesa.id == comanda_mesa.c.mesa_id)
            .where(
                Mesa.activo,
                Comanda.fecha_hora_apertura < fin,
                (Comanda.fecha_hora_cierre.is_(None))
                | (Comanda.fecha_hora_cierre > inicio),
            )
        )
        if sector_id is not None:
            consulta = consulta.where(Mesa.sector_id == sector_id)
        return list(self.db.execute(consulta))

    # --- HU-12e ---
    def reservas_por_estado(self, inicio: datetime, fin: datetime) -> list:
        consulta = (
            select(Reserva.estado, func.count(Reserva.id))
            .where(Reserva.fecha_hora >= inicio, Reserva.fecha_hora < fin)
            .group_by(Reserva.estado)
        )
        return list(self.db.execute(consulta))

    def senas_retenidas(self, inicio: datetime, fin: datetime):
        consulta = (
            select(func.sum(Sena.monto))
            .join(Reserva, Reserva.id == Sena.reserva_id)
            .where(
                Reserva.estado == EstadoReserva.AUSENTE,
                Sena.devuelta.is_(False),
                Reserva.fecha_hora >= inicio,
                Reserva.fecha_hora < fin,
            )
        )
        return self.db.scalar(consulta)

    def clientes_con_ausencias(
        self, inicio: datetime, fin: datetime, limite: int
    ) -> list:
        es_ausente = Reserva.estado == EstadoReserva.AUSENTE
        ausencias = func.sum(case((es_ausente, 1), else_=0))
        ultima = func.max(case((es_ausente, Reserva.fecha_hora)))
        consulta = (
            select(Cliente, ausencias, func.count(Reserva.id))
            .join(Reserva, Reserva.cliente_id == Cliente.id)
            .where(Reserva.fecha_hora >= inicio, Reserva.fecha_hora < fin)
            .group_by(Cliente.id)
            .having(ausencias > 0)
            .order_by(ausencias.desc(), ultima.desc())
            .limit(limite)
        )
        return list(self.db.execute(consulta))

    # --- HU-12f ---
    def cobros_por_medio(self, inicio: datetime, fin: datetime) -> list:
        consulta = (
            select(
                MedioPago,
                func.count(DetallePago.id),
                func.sum(DetallePago.monto_abonado),
                func.sum(DetallePago.monto_con_recargo),
            )
            .join(DetallePago, DetallePago.medio_pago_id == MedioPago.id)
            .join(Factura, Factura.id == DetallePago.factura_id)
            .where(
                Factura.estado == EstadoFactura.PAGADA,
                Factura.fecha >= inicio,
                Factura.fecha < fin,
            )
            .group_by(MedioPago.id)
        )
        return list(self.db.execute(consulta))
