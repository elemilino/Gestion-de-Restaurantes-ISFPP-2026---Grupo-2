"""Registro de los routers de todos los módulos bajo /api/v1.

Ya están todos registrados: para trabajar una HU no hace falta tocar este archivo,
solo agregar endpoints en `app/modules/<modulo>/router.py`.
"""

from fastapi import APIRouter

from app.modules.auth.router import router as auth
from app.modules.carta.router import router as carta
from app.modules.clientes.router import router as clientes
from app.modules.comandas.router import router as comandas
from app.modules.facturacion.router import router as facturacion
from app.modules.medios_pago.router import router as medios_pago
from app.modules.mozos.router import router as mozos
from app.modules.promociones.router import router as promociones
from app.modules.reportes.router import router as reportes
from app.modules.reservas.router import router as reservas
from app.modules.salon.router import router as salon

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth, prefix="/auth", tags=["Autenticación"])
api_router.include_router(salon, prefix="/salon", tags=["Salón (HU-01a/b)"])
api_router.include_router(mozos, prefix="/mozos", tags=["Mozos (HU-02)"])
api_router.include_router(carta, prefix="/carta", tags=["Carta (HU-03, HU-04)"])
api_router.include_router(
    comandas, prefix="/comandas", tags=["Comandas (HU-05, HU-06)"]
)
api_router.include_router(
    medios_pago, prefix="/medios-pago", tags=["Medios de pago (HU-07)"]
)
api_router.include_router(
    facturacion, prefix="/facturacion", tags=["Facturación (HU-08)"]
)
api_router.include_router(
    promociones, prefix="/promociones", tags=["Promociones y menús (HU-09)"]
)
api_router.include_router(clientes, prefix="/clientes", tags=["Clientes (HU-10)"])
api_router.include_router(reservas, prefix="/reservas", tags=["Reservas (HU-11)"])
api_router.include_router(reportes, prefix="/reportes", tags=["Reportes"])
