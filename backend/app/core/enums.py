"""Enumerados compartidos del dominio.

Solo están los mínimos para arrancar. Cada HU agrega los valores que necesite
(por ejemplo, el rol CAJERO lo agrega HU-08) en un commit aparte y avisando al grupo.
"""

from enum import StrEnum


class Rol(StrEnum):
    ADMINISTRADOR = "ADMINISTRADOR"
    MOZO = "MOZO"
    CAJERO = "CAJERO"
    RECEPCIONISTA = "RECEPCIONISTA"


class TipoProducto(StrEnum):
    PLATO = "PLATO"
    POSTRE = "POSTRE"
    BEBIDA = "BEBIDA"


class EstadoComanda(StrEnum):
    """Estados de la comanda definidos en HU-05."""

    ABIERTA = "ABIERTA"
    CERRADA = "CERRADA"
    FACTURADA = "FACTURADA"
    ANULADA = "ANULADA"


class EstadoReserva(StrEnum):
    """Estados de la reserva. Provisorios: los define HU-11a.

    HU-01b solo usa ACTIVA (las reservas activas bloquean cambios en sus mesas).
    """

    ACTIVA = "ACTIVA"
    CANCELADA = "CANCELADA"
    FINALIZADA = "FINALIZADA"


class TipoAcreditacion(StrEnum):
    """Tipos de acreditación para medios de pago (HU-07)."""

    INMEDIATA = "Inmediata"
    DIFERIDA = "Diferida"


class EstadoFactura(StrEnum):
    """Estados de la factura (HU-08)."""

    ADEUDADA = "Adeudada"
    PAGADA = "Pagada"


class TipoFactura(StrEnum):
    """Tipos de comprobante fiscal (HU-08)."""

    A = "A"
    B = "B"
    C = "C"
    CONSUMIDOR_FINAL = "Consumidor Final"
