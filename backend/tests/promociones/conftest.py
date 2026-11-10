"""Fixtures del módulo promociones: crean productos y promociones directo con `db`."""

from datetime import date, timedelta
from decimal import Decimal
from itertools import count

import pytest

from app.core.enums import TipoProducto
from app.models.carta import Producto, SeccionCarta
from app.models.promociones import Promocion


@pytest.fixture
def seccion(db):
    seccion = SeccionCarta(nombre="Carta", orden=1, activo=True)
    db.add(seccion)
    db.commit()
    return seccion


@pytest.fixture
def crear_producto(db, seccion):
    numeros = count(1)

    def _crear(nombre=None, activo=True, precio="1000"):
        n = next(numeros)
        producto = Producto(
            nombre=nombre or f"Producto {n}",
            seccion_id=seccion.id,
            tipo=TipoProducto.PLATO,
            precio=Decimal(precio),
            activo=activo,
        )
        db.add(producto)
        db.commit()
        return producto

    return _crear


@pytest.fixture
def crear_promocion(db):
    """Inserta una promoción directo en la base.

    Sirve para los casos que la API no permite crear a propósito: promociones
    vencidas o con fecha de inicio pasada (para probar la expiración lazy y la
    edición de promociones ya comenzadas).
    """

    def _crear(
        descripcion="Promo",
        fecha_inicio=None,
        fecha_fin=None,
        descuento="10.00",
        activo=True,
        productos=None,
    ):
        hoy = date.today()
        promocion = Promocion(
            descripcion=descripcion,
            fecha_inicio=fecha_inicio or hoy,
            fecha_fin=fecha_fin or hoy + timedelta(days=5),
            descuento=Decimal(descuento),
            activo=activo,
            productos=productos or [],
        )
        db.add(promocion)
        db.commit()
        return promocion

    return _crear
