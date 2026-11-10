"""HU-04d con comandas: disponibilidad y stock al cargar productos (HU-05b).

El stock se descuenta al cargar el producto en la comanda (CA3: "cuando se
agregan 2 unidades a una comanda, su stock pasa a 8") y se repone cuando las
unidades salen de la comanda sin entregarse (quitar, reducir, anular o eliminar).
"""

import pytest

from app.core.enums import Rol
from app.models.personal import Mozo
from app.models.salon import Mesa, Sector

URL = "/api/v1/comandas"


@pytest.fixture
def comanda_id(db, client, headers) -> int:
    """Comanda abierta del mozo 12345678 en la mesa 1."""
    client.headers.update(headers(Rol.MOZO))
    sector = Sector(nombre="Salón")
    db.add(sector)
    db.flush()
    db.add_all(
        [
            Mesa(numero=1, capacidad=4, sector_id=sector.id),
            Mozo(dni="12345678", nombre="Ana", apellido="Ruiz", sector_id=sector.id),
        ]
    )
    db.commit()
    r = client.post(
        URL,
        json={"dni_mozo": "12345678", "cantidad_comensales": 2, "numeros_mesa": [1]},
    )
    assert r.status_code == 201
    return r.json()["id"]


@pytest.fixture
def milanesa(crear_seccion, crear_producto):
    return lambda **kw: crear_producto("Milanesa", crear_seccion("Minutas"), **kw)


def _agregar(client, comanda_id, producto_id, cantidad):
    return client.post(
        f"{URL}/{comanda_id}/detalles",
        json={"producto_id": producto_id, "cantidad": cantidad},
    )


def _stock(db, producto) -> int | None:
    db.refresh(producto)
    return producto.stock


def test_hu04d_ca1_no_disponible_no_se_carga_en_la_comanda(
    client, comanda_id, milanesa
):
    producto = milanesa(disponible=False)
    r = _agregar(client, comanda_id, producto.id, 1)
    assert r.status_code == 422
    assert r.json()["code"] == "PRODUCTO_NO_DISPONIBLE"


def test_hu04d_ca3_cargar_en_la_comanda_descuenta_stock(
    db, client, comanda_id, milanesa
):
    producto = milanesa(stock=10)
    assert _agregar(client, comanda_id, producto.id, 2).status_code == 200
    assert _stock(db, producto) == 8


def test_hu04d_ca3_sumar_unidades_descuenta_la_diferencia(
    db, client, comanda_id, milanesa
):
    producto = milanesa(stock=10)
    detalle_id = _agregar(client, comanda_id, producto.id, 2).json()["detalles"][0][
        "id"
    ]
    r = client.patch(f"{URL}/{comanda_id}/detalles/{detalle_id}", json={"cantidad": 5})
    assert r.status_code == 200
    assert _stock(db, producto) == 5


def test_hu04d_ca4_sin_stock_no_se_carga(db, client, comanda_id, milanesa):
    producto = milanesa(stock=0)
    r = _agregar(client, comanda_id, producto.id, 1)
    assert r.status_code == 422
    assert r.json()["code"] == "PRODUCTO_SIN_STOCK"
    assert _stock(db, producto) == 0


def test_hu04d_ca4_no_alcanza_el_stock(db, client, comanda_id, milanesa):
    producto = milanesa(stock=3)
    r = _agregar(client, comanda_id, producto.id, 4)
    assert r.status_code == 422
    assert r.json()["code"] == "PRODUCTO_SIN_STOCK"
    assert _stock(db, producto) == 3


def test_hu04d_ca6_sin_control_de_stock_no_descuenta(db, client, comanda_id, milanesa):
    producto = milanesa(stock=None)
    assert _agregar(client, comanda_id, producto.id, 3).status_code == 200
    assert _stock(db, producto) is None


def test_hu04d_quitar_o_reducir_repone_el_stock(db, client, comanda_id, milanesa):
    producto = milanesa(stock=10)
    detalle_id = _agregar(client, comanda_id, producto.id, 4).json()["detalles"][0][
        "id"
    ]
    client.patch(f"{URL}/{comanda_id}/detalles/{detalle_id}", json={"cantidad": 1})
    assert _stock(db, producto) == 9
    assert client.delete(f"{URL}/{comanda_id}/detalles/{detalle_id}").status_code == 200
    assert _stock(db, producto) == 10


def test_hu04d_anular_la_comanda_repone_el_stock(db, client, comanda_id, milanesa):
    producto = milanesa(stock=10)
    _agregar(client, comanda_id, producto.id, 3)
    r = client.post(f"{URL}/{comanda_id}/anulacion", json={"motivo": "Se fueron"})
    assert r.status_code == 200
    assert _stock(db, producto) == 10


def test_hu04d_eliminar_la_comanda_repone_el_stock(db, client, comanda_id, milanesa):
    producto = milanesa(stock=10)
    _agregar(client, comanda_id, producto.id, 3)
    assert client.delete(f"{URL}/{comanda_id}").status_code == 204
    assert _stock(db, producto) == 10
