"""Pruebas de HU-04b: gestión de postres (reutiliza la base común de HU-04a)."""

from decimal import Decimal

import pytest

from app.core.enums import TipoProducto
from app.models.comandas import DetalleComanda

URL_POSTRES = "/api/v1/carta/postres"
URL_PRODUCTOS = "/api/v1/carta/productos"


def datos_postre(seccion_id: int, **cambios) -> dict:
    datos = {"nombre": "Flan casero", "precio": 3000, "seccion_id": seccion_id}
    datos.update(cambios)
    return datos


def test_hu04b_ca1_crea_postre(client, headers, crear_seccion):
    postres = crear_seccion("Postres")
    r = client.post(URL_POSTRES, json=datos_postre(postres.id), headers=headers())
    assert r.status_code == 201
    postre = r.json()
    assert postre["tipo"] == "POSTRE"
    assert postre["disponible"] is True
    assert postre["precio"] == "3000.00"
    r = client.get(URL_PRODUCTOS, params={"tipo": "POSTRE"}, headers=headers())
    assert [p["nombre"] for p in r.json()] == ["Flan casero"]


def test_hu04b_ca1_con_porcion(client, headers, crear_seccion):
    postres = crear_seccion("Postres")
    datos = datos_postre(postres.id, porcion_gramos=120)
    r = client.post(URL_POSTRES, json=datos, headers=headers())
    assert r.status_code == 201
    assert r.json()["porcion_gramos"] == 120


def test_hu04b_ca2_rechaza_duplicado(client, headers, crear_seccion, crear_producto):
    postres = crear_seccion("Postres")
    crear_producto("Flan casero", postres, tipo=TipoProducto.POSTRE)
    datos = datos_postre(postres.id, nombre="flan casero")
    r = client.post(URL_POSTRES, json=datos, headers=headers())
    assert r.status_code == 409
    assert r.json() == {
        "detail": "Ya existe un postre con ese nombre",
        "code": "PRODUCTO_DUPLICADO",
    }


def test_hu04b_ca2_permite_mismo_nombre_que_un_plato(
    client, headers, crear_seccion, crear_producto
):
    postres = crear_seccion("Postres")
    crear_producto("Flan casero", postres, tipo=TipoProducto.PLATO)
    r = client.post(URL_POSTRES, json=datos_postre(postres.id), headers=headers())
    assert r.status_code == 201


@pytest.mark.parametrize("cambios", [{"precio": 0}, {"seccion_id": None}])
def test_hu04b_ca2_rechaza_datos_invalidos(client, headers, crear_seccion, cambios):
    postres = crear_seccion("Postres")
    datos = {**datos_postre(postres.id), **cambios}
    datos = {k: v for k, v in datos.items() if v is not None}
    r = client.post(URL_POSTRES, json=datos, headers=headers())
    assert r.status_code == 422


def test_hu04b_ca2_seccion_inactiva(client, headers, crear_seccion):
    crear_seccion("Postres")
    eliminada = crear_seccion("Vieja", activo=False)
    r = client.post(URL_POSTRES, json=datos_postre(eliminada.id), headers=headers())
    assert r.status_code == 422
    assert r.json()["code"] == "SECCION_INVALIDA"


def test_hu04b_ca3_cambio_de_precio_no_afecta_comanda_abierta(
    client, headers, db, crear_seccion, crear_producto, crear_comanda_con
):
    postres = crear_seccion("Postres")
    postre = crear_producto(
        "Flan casero", postres, tipo=TipoProducto.POSTRE, precio="3000"
    )
    detalle = crear_comanda_con(postre, precio_unitario="3000")

    datos = datos_postre(postres.id, precio=3300)
    r = client.put(f"{URL_POSTRES}/{postre.id}", json=datos, headers=headers())
    assert r.status_code == 200
    assert r.json()["precio"] == "3300.00"
    db.expire_all()
    assert db.get(DetalleComanda, detalle.id).precio_unitario == Decimal("3000")


def test_hu04b_ca4_elimina_postre(client, headers, crear_seccion, crear_producto):
    postres = crear_seccion("Postres")
    postre = crear_producto("Flan casero", postres, tipo=TipoProducto.POSTRE)
    r = client.delete(f"{URL_PRODUCTOS}/{postre.id}", headers=headers())
    assert r.status_code == 204
    assert client.get(URL_PRODUCTOS, headers=headers()).json() == []


def test_hu04b_ca5_bloquea_si_esta_en_comanda_abierta(
    client, headers, crear_seccion, crear_producto, crear_comanda_con
):
    postres = crear_seccion("Postres")
    postre = crear_producto("Flan casero", postres, tipo=TipoProducto.POSTRE)
    crear_comanda_con(postre)
    r = client.delete(f"{URL_PRODUCTOS}/{postre.id}", headers=headers())
    assert r.status_code == 409
    assert r.json()["code"] == "PRODUCTO_EN_USO"
    assert "1 comandas abiertas" in r.json()["detail"]


def test_hu04b_put_sobre_plato_404(client, headers, crear_seccion, crear_producto):
    postres = crear_seccion("Postres")
    plato = crear_producto("Flan casero", postres, tipo=TipoProducto.PLATO)
    r = client.put(
        f"{URL_POSTRES}/{plato.id}", json=datos_postre(postres.id), headers=headers()
    )
    assert r.status_code == 404
    assert r.json()["code"] == "PRODUCTO_NO_ENCONTRADO"
