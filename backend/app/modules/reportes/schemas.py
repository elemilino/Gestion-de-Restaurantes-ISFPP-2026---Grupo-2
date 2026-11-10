"""Schemas de los reportes (HU-12a a HU-12f)."""

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel

from app.core.enums import EstadoReserva, TipoAcreditacion, TipoProducto


class Periodo(StrEnum):
    HOY = "HOY"
    SEMANA = "SEMANA"
    MES = "MES"
    PERSONALIZADO = "PERSONALIZADO"


class PeriodoFiltro(BaseModel):
    """Período común a los 6 reportes (por defecto, el mes actual)."""

    periodo: Periodo = Periodo.MES
    desde: date | None = None
    hasta: date | None = None


class ProductosFiltro(PeriodoFiltro):
    tipo: TipoProducto | None = None
    seccion_id: int | None = None


class MozosFiltro(PeriodoFiltro):
    dni: str | None = None


class OcupacionFiltro(PeriodoFiltro):
    sector_id: int | None = None


class ReporteBase(BaseModel):
    desde: date
    hasta: date
    # Mensaje para mostrar cuando no hay datos (CA "Sin datos").
    mensaje: str | None = None


# --- HU-12a ---


class VentaDia(BaseModel):
    fecha: date
    total: Decimal


class ReporteVentas(ReporteBase):
    total_facturado: Decimal
    cantidad_facturas: int
    ticket_promedio: Decimal
    pendiente_cobro: Decimal
    por_dia: list[VentaDia]


# --- HU-12b ---


class ProductoVendido(BaseModel):
    posicion: int
    producto_id: int
    nombre: str
    tipo: TipoProducto
    seccion: str
    unidades: int
    importe: Decimal
    eliminado: bool


class ReporteProductos(ReporteBase):
    productos: list[ProductoVendido]


# --- HU-12c ---


class ComandaDeMozo(BaseModel):
    comanda_id: int
    fecha_hora_cierre: datetime
    mesas: list[int]
    comensales: int
    importe: Decimal


class VentasMozo(BaseModel):
    mozo_id: int
    dni: str
    nombre: str
    apellido: str
    comandas: int
    comensales: int
    total_facturado: Decimal
    promedio_por_comanda: Decimal
    dado_de_baja: bool
    detalle: list[ComandaDeMozo] = []


class ReporteMozos(ReporteBase):
    mozos: list[VentasMozo]


# --- HU-12d ---


class CeldaOcupacion(BaseModel):
    dia_semana: int  # 0 = lunes ... 6 = domingo
    hora: int  # franja de hora a hora+1
    porcentaje: float


class FranjaMaxima(CeldaOcupacion):
    etiqueta: str


class ReporteOcupacion(ReporteBase):
    mesas_activas: int
    celdas: list[CeldaOcupacion]
    ocupacion_promedio: float
    franja_maxima: FranjaMaxima | None


# --- HU-12e ---


class ReservasPorEstado(BaseModel):
    estado: EstadoReserva
    cantidad: int
    porcentaje: float


class ClienteAusente(BaseModel):
    cliente_id: int
    nombre: str
    apellido: str
    dni: str
    telefono: str
    ausencias: int
    total_reservas: int
    dado_de_baja: bool


class ReporteReservas(ReporteBase):
    total_reservas: int
    por_estado: list[ReservasPorEstado]
    senas_retenidas: Decimal
    clientes_ausentes: list[ClienteAusente]


# --- HU-12f ---


class CobroMedio(BaseModel):
    medio_pago_id: int
    nombre: str
    tipo_acreditacion: TipoAcreditacion
    cantidad_pagos: int
    monto_abonado: Decimal
    recargo: Decimal
    total_cobrado: Decimal
    porcentaje: float
    dado_de_baja: bool


class ReporteCobros(ReporteBase):
    total_cobrado: Decimal
    medios: list[CobroMedio]
