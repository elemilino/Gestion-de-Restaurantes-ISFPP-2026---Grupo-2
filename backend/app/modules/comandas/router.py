"""Módulo comandas: ciclo de vida de la comanda y entrega de productos.

Lo completan: HU-05a a HU-05f, HU-06.
Para empezar, seguí el patrón del módulo `auth`: crear `schemas.py`,
`service.py` y `repository.py` en esta carpeta y agregar los endpoints acá.
El prefijo (/api/v1/...) y el tag de Swagger ya están registrados en `app/api.py`.
"""

from fastapi import APIRouter

router = APIRouter()
