"""Reportes del encargado general (HU-12a a HU-12f).

Reglas comunes (decisiones R3 a R6 de las HU):
- Período: Hoy, Semana actual (desde el lunes), Mes actual (por defecto) o
  Personalizado con fecha desde y hasta incluidas; desde > hasta o una fecha
  futura es un período inválido.
- "Venta" = factura Pagada, por la fecha de la factura.
- Lo dado de baja sigue apareciendo, marcado.
"""

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.enums import EstadoReserva
from app.core.exceptions import BusinessRuleError
from app.modules.reportes.repository import ReporteRepository
from app.modules.reportes.schemas import (
    CeldaOcupacion,
    ClienteAusente,
    CobroMedio,
    ComandaDeMozo,
    FranjaMaxima,
    MozosFiltro,
    OcupacionFiltro,
    Periodo,
    PeriodoFiltro,
    ProductosFiltro,
    ProductoVendido,
    ReporteCobros,
    ReporteMozos,
    ReporteOcupacion,
    ReporteProductos,
    ReporteReservas,
    ReporteVentas,
    ReservasPorEstado,
    VentaDia,
    VentasMozo,
)

CERO = Decimal("0.00")
TOP = 10
DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def _plata(valor) -> Decimal:
    """Normaliza a 2 decimales lo que devuelve un SUM (puede ser None o float)."""
    return Decimal(str(valor or 0)).quantize(Decimal("0.01"))


def _porcentaje(parte, total) -> float:
    return round(float(parte) * 100 / float(total), 1) if total else 0.0


def rango(filtro: PeriodoFiltro, hoy: date | None = None) -> tuple[date, date]:
    """Primer y último día del período (ambos incluidos)."""
    hoy = hoy or date.today()
    if filtro.periodo == Periodo.HOY:
        return hoy, hoy
    if filtro.periodo == Periodo.SEMANA:
        return hoy - timedelta(days=hoy.weekday()), hoy
    if filtro.periodo == Periodo.MES:
        return hoy.replace(day=1), hoy
    desde, hasta = filtro.desde, filtro.hasta
    if desde is None or hasta is None or desde > hasta or hasta > hoy:
        raise BusinessRuleError(
            "El período seleccionado no es válido", "PERIODO_INVALIDO"
        )
    return desde, hasta


def _limites(desde: date, hasta: date) -> tuple[datetime, datetime]:
    return datetime.combine(desde, time.min), datetime.combine(
        hasta + timedelta(days=1), time.min
    )


class ReporteService:
    def __init__(self, db: Session):
        self.repo = ReporteRepository(db)

    # ---------- HU-12a ----------
    def ventas(self, filtro: PeriodoFiltro) -> ReporteVentas:
        """CA1 a CA5: total facturado, cantidad, ticket promedio, pendiente, por día."""
        desde, hasta = rango(filtro)
        inicio, fin = _limites(desde, hasta)
        filas = self.repo.facturas_pagadas_por_dia(inicio, fin)
        por_dia = {
            date.fromisoformat(str(dia)): (_plata(total), cantidad)
            for dia, total, cantidad in filas
        }
        total = sum((t for t, _ in por_dia.values()), CERO)
        cantidad = sum(c for _, c in por_dia.values())
        dias = [desde + timedelta(days=i) for i in range((hasta - desde).days + 1)]
        return ReporteVentas(
            desde=desde,
            hasta=hasta,
            total_facturado=total,
            cantidad_facturas=cantidad,
            ticket_promedio=_plata(total / cantidad) if cantidad else CERO,
            pendiente_cobro=_plata(self.repo.pendiente_de_cobro(inicio, fin)),
            por_dia=[
                VentaDia(fecha=d, total=por_dia.get(d, (CERO, 0))[0]) for d in dias
            ],
            mensaje=None if cantidad else "No hay ventas en el período seleccionado",
        )

    # ---------- HU-12b ----------
    def productos_mas_vendidos(self, filtro: ProductosFiltro) -> ReporteProductos:
        """CA1 a CA6: top 10 por unidades (desempate: importe y nombre)."""
        desde, hasta = rango(filtro)
        inicio, fin = _limites(desde, hasta)
        filas = self.repo.productos_vendidos(
            inicio, fin, filtro.tipo, filtro.seccion_id
        )
        filas.sort(key=lambda f: (-int(f[5]), -_plata(f[6]), f[1].lower()))
        productos = [
            ProductoVendido(
                posicion=i,
                producto_id=pid,
                nombre=nombre,
                tipo=tipo,
                seccion=seccion,
                unidades=int(unidades),
                importe=_plata(importe),
                eliminado=not activo,
            )
            for i, (pid, nombre, tipo, seccion, activo, unidades, importe) in enumerate(
                filas[:TOP], start=1
            )
        ]
        return ReporteProductos(
            desde=desde,
            hasta=hasta,
            productos=productos,
            mensaje=None if productos else "No hay ventas en el período seleccionado",
        )

    # ---------- HU-12c ----------
    def mozos(self, filtro: MozosFiltro) -> ReporteMozos:
        """CA1 a CA6: comandas cerradas, comensales y facturado por mozo."""
        desde, hasta = rango(filtro)
        inicio, fin = _limites(desde, hasta)
        mozo_id = None
        if filtro.dni:
            mozo = self.repo.buscar_mozo_por_dni(filtro.dni.strip())
            if mozo is None:
                raise BusinessRuleError(
                    f"No existe un mozo con DNI {filtro.dni}", "MOZO_INEXISTENTE"
                )
            mozo_id = mozo.id
        mozos = []
        for mozo, comandas, comensales, facturado in self.repo.ventas_por_mozo(
            inicio, fin, mozo_id
        ):
            total = _plata(facturado)
            detalle = []
            if mozo_id is not None:  # CA2
                detalle = [
                    ComandaDeMozo(
                        comanda_id=c.id,
                        fecha_hora_cierre=c.fecha_hora_cierre,
                        mesas=sorted(m.numero for m in c.mesas),
                        comensales=c.cantidad_comensales,
                        importe=_plata(
                            sum(d.cantidad * d.precio_unitario for d in c.detalles)
                        ),
                    )
                    for c in self.repo.comandas_cerradas_de(mozo.id, inicio, fin)
                ]
            mozos.append(
                VentasMozo(
                    mozo_id=mozo.id,
                    dni=mozo.dni,
                    nombre=mozo.nombre,
                    apellido=mozo.apellido,
                    comandas=comandas,
                    comensales=int(comensales or 0),
                    total_facturado=total,
                    promedio_por_comanda=_plata(total / comandas),
                    dado_de_baja=not mozo.activo,
                    detalle=detalle,
                )
            )
        mozos.sort(key=lambda m: (-m.total_facturado, m.apellido, m.nombre))
        return ReporteMozos(
            desde=desde,
            hasta=hasta,
            mozos=mozos,
            mensaje=None if mozos else "No hay comandas en el período seleccionado",
        )

    # ---------- HU-12d ----------
    def ocupacion(
        self, filtro: OcupacionFiltro, ahora: datetime | None = None
    ) -> ReporteOcupacion:
        """CA1 a CA6: mapa de calor día de la semana × franja de una hora.

        Una mesa está ocupada en una franja si alguna comanda suya se superpone
        con esa hora (CA2); una comanda abierta cuenta hasta ahora (CA4). El
        porcentaje de una celda es mesas ocupadas / mesas activas, promediado
        entre los días del período que caen en ese día de la semana. La
        ocupación promedio se calcula sobre las franjas con actividad.
        """
        ahora = ahora or datetime.now()
        desde, hasta = rango(filtro)
        inicio, fin = _limites(desde, hasta)
        mesas = self.repo.contar_mesas_activas(filtro.sector_id)

        ocupadas: dict[tuple[date, int], set[int]] = defaultdict(set)
        for apertura, cierre, mesa_id in self.repo.intervalos_de_mesas(
            inicio, fin, filtro.sector_id
        ):
            desde_h = max(apertura, inicio).replace(minute=0, second=0, microsecond=0)
            hasta_h = min(cierre or ahora, fin)
            franja = desde_h
            while franja < hasta_h:
                ocupadas[(franja.date(), franja.hour)].add(mesa_id)
                franja += timedelta(hours=1)

        dias_por_semana = defaultdict(int)
        for i in range((hasta - desde).days + 1):
            dias_por_semana[(desde + timedelta(days=i)).weekday()] += 1
        suma: dict[tuple[int, int], int] = defaultdict(int)
        for (dia, hora), ids in ocupadas.items():
            suma[(dia.weekday(), hora)] += len(ids)

        celdas = [
            CeldaOcupacion(
                dia_semana=d,
                hora=h,
                porcentaje=(
                    _porcentaje(suma[(d, h)], mesas * dias_por_semana[d])
                    if (d, h) in suma
                    else 0.0
                ),
            )
            for d in range(7)
            for h in range(24)
        ]
        activas = [c for c in celdas if c.porcentaje > 0]
        maxima = max(activas, key=lambda c: c.porcentaje, default=None)
        return ReporteOcupacion(
            desde=desde,
            hasta=hasta,
            mesas_activas=mesas,
            celdas=celdas,
            ocupacion_promedio=(
                round(sum(c.porcentaje for c in activas) / len(activas), 1)
                if activas
                else 0.0
            ),
            franja_maxima=(
                FranjaMaxima(
                    **maxima.model_dump(),
                    etiqueta=(
                        f"{DIAS[maxima.dia_semana]} {maxima.hora} a "
                        f"{maxima.hora + 1} h: {maxima.porcentaje:g} %"
                    ),
                )
                if maxima
                else None
            ),
            mensaje=(
                None
                if activas and mesas
                else "No hay ocupación registrada en el período seleccionado"
            ),
        )

    # ---------- HU-12e ----------
    def reservas(self, filtro: PeriodoFiltro) -> ReporteReservas:
        """CA1 a CA5: reservas por estado, señas retenidas y top 10 de ausentes."""
        desde, hasta = rango(filtro)
        inicio, fin = _limites(desde, hasta)
        conteo = dict(self.repo.reservas_por_estado(inicio, fin))
        total = sum(conteo.values())
        clientes = [
            ClienteAusente(
                cliente_id=c.id,
                nombre=c.nombre,
                apellido=c.apellido,
                dni=c.dni,
                telefono=c.telefono,
                ausencias=int(ausencias),
                total_reservas=total_reservas,
                dado_de_baja=not c.activo,
            )
            for c, ausencias, total_reservas in self.repo.clientes_con_ausencias(
                inicio, fin, TOP
            )
        ]
        return ReporteReservas(
            desde=desde,
            hasta=hasta,
            total_reservas=total,
            por_estado=[
                ReservasPorEstado(
                    estado=e,
                    cantidad=conteo.get(e, 0),
                    porcentaje=_porcentaje(conteo.get(e, 0), total),
                )
                for e in EstadoReserva
            ],
            senas_retenidas=_plata(self.repo.senas_retenidas(inicio, fin)),
            clientes_ausentes=clientes,
            mensaje=None if total else "No hay reservas en el período seleccionado",
        )

    # ---------- HU-12f ----------
    def cobros(self, filtro: PeriodoFiltro) -> ReporteCobros:
        """CA1 a CA6: cobros de facturas Pagadas agrupados por medio de pago."""
        desde, hasta = rango(filtro)
        inicio, fin = _limites(desde, hasta)
        filas = [
            (medio, cantidad, _plata(abonado), _plata(con_recargo))
            for medio, cantidad, abonado, con_recargo in self.repo.cobros_por_medio(
                inicio, fin
            )
        ]
        total = sum((f[3] for f in filas), CERO)
        medios = [
            CobroMedio(
                medio_pago_id=medio.id,
                nombre=medio.nombre,
                tipo_acreditacion=medio.tipo_acreditacion,
                cantidad_pagos=cantidad,
                monto_abonado=abonado,
                recargo=con_recargo - abonado,
                total_cobrado=con_recargo,
                porcentaje=_porcentaje(con_recargo, total),
                dado_de_baja=not medio.activo,
            )
            for medio, cantidad, abonado, con_recargo in filas
        ]
        medios.sort(key=lambda m: (-m.total_cobrado, m.nombre))
        return ReporteCobros(
            desde=desde,
            hasta=hasta,
            total_cobrado=total,
            medios=medios,
            mensaje=None if medios else "No hay cobros en el período seleccionado",
        )
