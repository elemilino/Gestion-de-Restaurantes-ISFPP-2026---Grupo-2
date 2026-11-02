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
