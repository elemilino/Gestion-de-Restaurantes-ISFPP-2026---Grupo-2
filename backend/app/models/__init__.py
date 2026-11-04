"""Modelos del dominio. Importarlos acá registra sus tablas para `create_all`.

Cuando una HU agregue un modelo nuevo (ej. `clientes.py`), debe importarlo acá.
"""

from app.models.carta import Producto, SeccionCarta
from app.models.comandas import Comanda, DetalleComanda
from app.models.facturacion import DetallePago, Factura
from app.models.medios_pago import MedioPago
from app.models.personal import Mozo
from app.models.reservas import Reserva
from app.models.salon import Mesa, Sector
from app.models.usuario import Usuario

__all__ = [
    "Comanda",
    "DetalleComanda",
    "DetallePago",
    "Factura",
    "MedioPago",
    "Mesa",
    "Mozo",
    "Producto",
    "Reserva",
    "SeccionCarta",
    "Sector",
    "Usuario",
]
