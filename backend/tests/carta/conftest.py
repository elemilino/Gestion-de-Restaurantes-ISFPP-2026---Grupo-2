"""Fixtures del módulo carta: crean secciones, productos y comandas directo con `db`."""

from datetime import datetime
from decimal import Decimal
from itertools import count

import pytest

from app.core.enums import TipoProducto
from app.models.carta import Producto, SeccionCarta
from app.models.comandas import Comanda, DetalleComanda
from app.models.personal import Mozo
from app.models.salon import Mesa, Sector


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
        descripcion: str | None = None,
        porcion_gramos: int | None = None,
        disponible: bool = True,
        stock: int | None = None,
        volumen_ml: int | None = None,
        alcoholica: bool | None = None,
    ):
        producto = Producto(
            nombre=nombre,
            seccion_id=seccion.id,
            tipo=tipo,
            precio=Decimal(precio),
            activo=activo,
            descripcion=descripcion,
            porcion_gramos=porcion_gramos,
            disponible=disponible,
            stock=stock,
            volumen_ml=volumen_ml,
            alcoholica=alcoholica,
        )
        db.add(producto)
        db.commit()
        return producto

    return _crear


@pytest.fixture
def crear_comanda_con(db):
    """Crea una comanda (con su sector, mesa y mozo) que tiene el producto cargado.

    HU-05 todavía no tiene endpoints: se inserta directo en la base.
    """
    numeros = count(1)

    def _crear(
        producto: Producto,
        precio_unitario: str = "1000",
        cerrada: bool = False,
        cantidad: int = 1,
    ) -> DetalleComanda:
        n = next(numeros)
        sector = Sector(nombre=f"Sector {n}")
        db.add(sector)
        db.flush()
        mesa = Mesa(numero=n, capacidad=4, sector_id=sector.id)
        mozo = Mozo(dni=f"{n:08d}", nombre="Mozo", apellido=f"Prueba {n}")
        db.add_all([mesa, mozo])
        db.flush()
        comanda = Comanda(
            mozo_id=mozo.id,
            cantidad_comensales=1,
            mesas=[mesa],
            fecha_hora_cierre=datetime.now() if cerrada else None,
        )
        db.add(comanda)
        db.flush()
        detalle = DetalleComanda(
            comanda_id=comanda.id,
            producto_id=producto.id,
            cantidad=cantidad,
            precio_unitario=Decimal(precio_unitario),
        )
        db.add(detalle)
        db.commit()
        return detalle

    return _crear
