"""Enumerados compartidos del dominio.

Solo están los mínimos para arrancar. Cada HU agrega los valores que necesite
(por ejemplo, el rol CAJERO lo agrega HU-08) en un commit aparte y avisando al grupo.
"""

from enum import StrEnum


class Rol(StrEnum):
    ADMINISTRADOR = "ADMINISTRADOR"
    MOZO = "MOZO"


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
