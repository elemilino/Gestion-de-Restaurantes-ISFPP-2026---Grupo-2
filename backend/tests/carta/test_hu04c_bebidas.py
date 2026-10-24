"""Pruebas de HU-04c: gestión de bebidas (unicidad por nombre y volumen)."""

from decimal import Decimal

import pytest

from app.core.enums import TipoProducto
from app.models.comandas import DetalleComanda

URL_BEBIDAS = "/api/v1/carta/bebidas"
URL_PLATOS = "/api/v1/carta/platos"
URL_PRODUCTOS = "/api/v1/carta/productos"


def datos_bebida(seccion_id: int, **cambios) -> dict:
    datos = {
        "nombre": "Cerveza tirada",
        "precio": 4000,
        "volumen_ml": 500,
        "alcoholica": True,
        "seccion_id": seccion_id,
    }
    datos.update(cambios)
    return datos


@pytest.fixture
def crear_bebida(crear_producto):
    def _crear(nombre, seccion, volumen_ml=500, **datos):
        return crear_producto(
            nombre,
            seccion,
            tipo=TipoProducto.BEBIDA,
            volumen_ml=volumen_ml,
            alcoholica=datos.pop("alcoholica", False),
            **datos,
        )

    return _crear


def test_hu04c_ca1_crea_bebida(client, headers, crear_seccion):
    cervezas = crear_seccion("Cervezas")
    r = client.post(URL_BEBIDAS, json=datos_bebida(cervezas.id), headers=headers())
    assert r.status_code == 201
    bebida = r.json()
    assert bebida["tipo"] == "BEBIDA"
    assert bebida["volumen_ml"] == 500
    assert bebida["alcoholica"] is True
    assert bebida["disponible"] is True
    assert bebida["porcion_gramos"] is None
    r = client.get(URL_PRODUCTOS, params={"seccion_id": cervezas.id}, headers=headers())
    assert [p["nombre"] for p in r.json()] == ["Cerveza tirada"]


def test_hu04c_ca2_rechaza_mismo_nombre_y_volumen(
    client, headers, crear_seccion, crear_bebida
):
    cervezas = crear_seccion("Cervezas")
    crear_bebida("Cerveza tirada", cervezas, volumen_ml=500)
    datos = datos_bebida(cervezas.id, nombre="cerveza tirada")
    r = client.post(URL_BEBIDAS, json=datos, headers=headers())
    assert r.status_code == 409
    assert r.json() == {
        "detail": "Ya existe una bebida con ese nombre y volumen",
        "code": "PRODUCTO_DUPLICADO",
    }


def test_hu04c_ca2_permite_mismo_nombre_otro_volumen(client, headers, crear_seccion):
    bebidas = crear_seccion("Bebidas sin alcohol")
    for volumen in [350, 1500]:
        datos = datos_bebida(
            bebidas.id, nombre="Gaseosa", volumen_ml=volumen, alcoholica=False
        )
        r = client.post(URL_BEBIDAS, json=datos, headers=headers())
        assert r.status_code == 201
    r = client.get(URL_PRODUCTOS, params={"tipo": "BEBIDA"}, headers=headers())
    assert sorted(p["volumen_ml"] for p in r.json()) == [350, 1500]


def test_hu04c_ca2_rechaza_cambiar_a_volumen_existente(
    client, headers, crear_seccion, crear_bebida
):
    bebidas = crear_seccion("Bebidas sin alcohol")
    crear_bebida("Gaseosa", bebidas, volumen_ml=350)
    grande = crear_bebida("Gaseosa", bebidas, volumen_ml=1500)
    datos = datos_bebida(bebidas.id, nombre="Gaseosa", volumen_ml=350)
    r = client.put(f"{URL_BEBIDAS}/{grande.id}", json=datos, headers=headers())
    assert r.status_code == 409


@pytest.mark.parametrize(
    "cambios",
    [
        {"volumen_ml": 0},
        {"volumen_ml": None},
        {"volumen_ml": 2.5},
        {"precio": 0},
        {"seccion_id": None},
        {"alcoholica": None},
    ],
)
def test_hu04c_ca2_rechaza_datos_invalidos(client, headers, crear_seccion, cambios):
    cervezas = crear_seccion("Cervezas")
    datos = {**datos_bebida(cervezas.id), **cambios}
    datos = {k: v for k, v in datos.items() if v is not None}
    r = client.post(URL_BEBIDAS, json=datos, headers=headers())
    assert r.status_code == 422


def test_hu04c_ca3_cambio_de_precio_no_afecta_comanda_abierta(
    client, headers, db, crear_seccion, crear_bebida, crear_comanda_con
):
    cervezas = crear_seccion("Cervezas")
    bebida = crear_bebida("Cerveza tirada", cervezas, precio="4000")
    detalle = crear_comanda_con(bebida, precio_unitario="4000")

    datos = datos_bebida(cervezas.id, precio=4500)
    r = client.put(f"{URL_BEBIDAS}/{bebida.id}", json=datos, headers=headers())
    assert r.status_code == 200
    assert r.json()["precio"] == "4500.00"
    db.expire_all()
    assert db.get(DetalleComanda, detalle.id).precio_unitario == Decimal("4000")


def test_hu04c_ca4_elimina_bebida(client, headers, crear_seccion, crear_bebida):
    cervezas = crear_seccion("Cervezas")
    bebida = crear_bebida("Cerveza tirada", cervezas)
    r = client.delete(f"{URL_PRODUCTOS}/{bebida.id}", headers=headers())
    assert r.status_code == 204
    assert client.get(URL_PRODUCTOS, headers=headers()).json() == []


def test_hu04c_ca5_bloquea_si_esta_en_comanda_abierta(
    client, headers, crear_seccion, crear_bebida, crear_comanda_con
):
    cervezas = crear_seccion("Cervezas")
    bebida = crear_bebida("Cerveza tirada", cervezas)
    crear_comanda_con(bebida)
    r = client.delete(f"{URL_PRODUCTOS}/{bebida.id}", headers=headers())
    assert r.status_code == 409
    assert r.json()["code"] == "PRODUCTO_EN_USO"


def test_hu04c_plato_y_bebida_con_mismo_nombre(
    client, headers, crear_seccion, crear_bebida
):
    seccion = crear_seccion("Especiales")
    crear_bebida("Fernet con cola", seccion)
    datos = {"nombre": "Fernet con cola", "precio": 100, "seccion_id": seccion.id}
    r = client.post(URL_PLATOS, json=datos, headers=headers())
    assert r.status_code == 201


def test_hu04c_put_sobre_otro_tipo_404(client, headers, crear_seccion, crear_producto):
    seccion = crear_seccion("Postres")
    postre = crear_producto("Flan casero", seccion, tipo=TipoProducto.POSTRE)
    datos = datos_bebida(seccion.id, nombre="Flan casero")
    r = client.put(f"{URL_BEBIDAS}/{postre.id}", json=datos, headers=headers())
    assert r.status_code == 404
