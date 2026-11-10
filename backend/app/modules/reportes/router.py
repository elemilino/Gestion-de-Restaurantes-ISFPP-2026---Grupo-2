"""Módulo reportes: los 6 reportes del encargado general (HU-12a a HU-12f).

Solo de consulta. CA6 de HU-12a: solo el encargado general y el administrador.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.enums import Rol
from app.modules.reportes.schemas import (
    MozosFiltro,
    OcupacionFiltro,
    PeriodoFiltro,
    ProductosFiltro,
    ReporteCobros,
    ReporteMozos,
    ReporteOcupacion,
    ReporteProductos,
    ReporteReservas,
    ReporteVentas,
)
from app.modules.reportes.service import ReporteService

router = APIRouter(
    dependencies=[Depends(require_roles(Rol.ADMINISTRADOR, Rol.ENCARGADO_GENERAL))]
)


@router.get(
    "/ventas",
    response_model=ReporteVentas,
    summary="Ventas por período (HU-12a)",
)
def reporte_ventas(
    filtro: PeriodoFiltro = Depends(), db: Session = Depends(get_db)
) -> ReporteVentas:
    return ReporteService(db).ventas(filtro)


@router.get(
    "/productos-mas-vendidos",
    response_model=ReporteProductos,
    summary="Productos más vendidos (HU-12b)",
)
def reporte_productos(
    filtro: ProductosFiltro = Depends(), db: Session = Depends(get_db)
) -> ReporteProductos:
    return ReporteService(db).productos_mas_vendidos(filtro)


@router.get(
    "/mozos",
    response_model=ReporteMozos,
    summary="Ventas y comandas por mozo (HU-12c)",
)
def reporte_mozos(
    filtro: MozosFiltro = Depends(), db: Session = Depends(get_db)
) -> ReporteMozos:
    return ReporteService(db).mozos(filtro)


@router.get(
    "/ocupacion",
    response_model=ReporteOcupacion,
    summary="Ocupación de mesas por franja horaria (HU-12d)",
)
def reporte_ocupacion(
    filtro: OcupacionFiltro = Depends(), db: Session = Depends(get_db)
) -> ReporteOcupacion:
    return ReporteService(db).ocupacion(filtro)


@router.get(
    "/reservas",
    response_model=ReporteReservas,
    summary="Reservas por estado y clientes con más ausencias (HU-12e)",
)
def reporte_reservas(
    filtro: PeriodoFiltro = Depends(), db: Session = Depends(get_db)
) -> ReporteReservas:
    return ReporteService(db).reservas(filtro)


@router.get(
    "/cobros",
    response_model=ReporteCobros,
    summary="Cobros por medio de pago (HU-12f)",
)
def reporte_cobros(
    filtro: PeriodoFiltro = Depends(), db: Session = Depends(get_db)
) -> ReporteCobros:
    return ReporteService(db).cobros(filtro)
