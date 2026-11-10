"""Enumerados compartidos del dominio.

Solo están los mínimos para arrancar. Cada HU agrega los valores que necesite
(por ejemplo, el rol CAJERO lo agrega HU-08) en un commit aparte y avisando al grupo.
"""

from enum import StrEnum


class Rol(StrEnum):
    """Lista cerrada de actores (acuerdo del grupo del 04/11)."""

    ADMINISTRADOR = "ADMINISTRADOR"
    MOZO = "MOZO"
    CAJERO = "CAJERO"
    RECEPCIONISTA = "RECEPCIONISTA"
    # HU-09a/b y HU-12a–f (reportes).
    ENCARGADO_GENERAL = "ENCARGADO_GENERAL"
    # HU-09b (menús especiales).
    COCINERO = "COCINERO"


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
    """Estados de la reserva (HU-11a/b y diagrama de clases).

    HU-01b usa ACTIVA: las reservas activas bloquean cambios en sus mesas.
    """

    ACTIVA = "ACTIVA"
    CUMPLIDA = "CUMPLIDA"
    CANCELADA = "CANCELADA"
    AUSENTE = "AUSENTE"


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
