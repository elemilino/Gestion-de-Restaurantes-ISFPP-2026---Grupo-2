"""Endpoints del módulo facturacion (HU-08a, HU-08b)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.enums import Rol
from app.modules.facturacion.schemas import (
    ComandaPorFacturar,
    CobroCreate,
    ComprobanteOut,
    FacturaCreate,
    FacturaOut,
)
from app.modules.facturacion.service import FacturacionService

router = APIRouter()
solo_caja = [Depends(require_roles(Rol.ADMINISTRADOR, Rol.CAJERO))]


@router.get(
    "",
    response_model=list[FacturaOut],
    dependencies=solo_caja,
    summary="Listar facturas",
)
def listar_facturas(db: Session = Depends(get_db)):
    return FacturacionService(db).listar_facturas()


@router.get(
    "/comandas-por-facturar",
    response_model=list[ComandaPorFacturar],
    dependencies=solo_caja,
    summary="Comandas cerradas que todavía no tienen factura (HU-08a)",
)
def comandas_por_facturar(db: Session = Depends(get_db)):
    return FacturacionService(db).comandas_por_facturar()


@router.get(
    "/{factura_id}",
    response_model=FacturaOut,
    dependencies=solo_caja,
    summary="Obtener una factura por ID",
)
def obtener_factura(factura_id: int, db: Session = Depends(get_db)):
    return FacturacionService(db).obtener_factura(factura_id)


@router.post(
    "",
    response_model=FacturaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=solo_caja,
    summary="Generar factura a partir de comanda cerrada (HU-08a CA1)",
)
def generar_factura(datos: FacturaCreate, db: Session = Depends(get_db)):
    return FacturacionService(db).generar_factura(datos)


@router.post(
    "/{factura_id}/cobrar",
    response_model=FacturaOut,
    dependencies=solo_caja,
    summary="Cobrar una factura con uno o múltiples medios de pago (HU-08b)",
)
def cobrar_factura(factura_id: int, datos: CobroCreate, db: Session = Depends(get_db)):
    return FacturacionService(db).cobrar_factura(factura_id, datos)


@router.get(
    "/{factura_id}/comprobante",
    response_model=ComprobanteOut,
    dependencies=solo_caja,
    summary="Generar comprobante de pago descargable (HU-08b CA1, CA2)",
)
def obtener_comprobante(factura_id: int, db: Session = Depends(get_db)):
    return FacturacionService(db).obtener_comprobante(factura_id)
