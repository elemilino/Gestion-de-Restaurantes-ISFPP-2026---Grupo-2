"""Fixtures del módulo carta: crean secciones y productos directo con la sesión `db`."""

from decimal import Decimal

import pytest

from app.core.enums import TipoProducto
from app.models.carta import Producto, SeccionCarta


@pytest.fixture
def crear_seccion(db):
    def _crear(nombre: str, orden: int | None = None, activo: bool = True):
        if orden is None:
            orden = len(db.query(SeccionCarta).all()) + 1
        seccion = SeccionCarta(nombre=nombre, orden=orden, activo=activo)
        db.add(seccion)
        db.commit()
        return seccion

    return _crear


@pytest.fixture
def crear_producto(db):
    def _crear(
        nombre: str,
        seccion: SeccionCarta,
        tipo: TipoProducto = TipoProducto.PLATO,
        precio: str = "1000",
        activo: bool = True,
    ):
        producto = Producto(
            nombre=nombre,
            seccion_id=seccion.id,
            tipo=tipo,
            precio=Decimal(precio),
            activo=activo,
        )
        db.add(producto)
        db.commit()
        return producto

    return _crear
