"""Pruebas de HU-04a: gestión de platos (y base común de productos)."""

from decimal import Decimal

import pytest

from app.core.enums import Rol, TipoProducto
from app.models.carta import Producto
from app.models.comandas import DetalleComanda

URL_PLATOS = "/api/v1/carta/platos"
URL_PRODUCTOS = "/api/v1/carta/productos"


def datos_plato(seccion_id: int, **cambios) -> dict:
    datos = {
        "nombre": "Ñoquis con salsa",
        "descripcion": "Ñoquis de papa con salsa fileto",
        "precio": 5000,
        "porcion_gramos": 350,
        "seccion_id": seccion_id,
    }
    datos.update(cambios)
    return datos


def test_hu04a_ca1_crea_plato(client, headers, crear_seccion):
    pastas = crear_seccion("Pastas")
    r = client.post(URL_PLATOS, json=datos_plato(pastas.id), headers=headers())
    assert r.status_code == 201
    plato = r.json()
    assert plato["tipo"] == "PLATO"
    assert plato["disponible"] is True
    assert plato["stock"] is None
    assert plato["porcion_gramos"] == 350
    assert plato["precio"] == "5000.00"
    assert plato["descripcion"] == "Ñoquis de papa con salsa fileto"

    r = client.get(URL_PRODUCTOS, params={"seccion_id": pastas.id}, headers=headers())
    assert [p["nombre"] for p in r.json()] == ["Ñoquis con salsa"]
    r = client.get(f"{URL_PRODUCTOS}/{plato['id']}", headers=headers())
    assert r.status_code == 200
    assert r.json()["nombre"] == "Ñoquis con salsa"


def test_hu04a_ca1_sin_descripcion_ni_porcion(client, headers, crear_seccion):
    pastas = crear_seccion("Pastas")
    datos = {"nombre": "Ravioles", "precio": "4500.50", "seccion_id": pastas.id}
    r = client.post(URL_PLATOS, json=datos, headers=headers())
    assert r.status_code == 201
    assert r.json()["descripcion"] is None
    assert r.json()["porcion_gramos"] is None
    assert r.json()["precio"] == "4500.50"


def test_hu04a_ca2_rechaza_nombre_duplicado(
    client, headers, crear_seccion, crear_producto
):
    pastas = crear_seccion("Pastas")
    crear_producto("Ñoquis con salsa", pastas)
    datos = datos_plato(pastas.id, nombre="ÑOQUIS CON SALSA")
    r = client.post(URL_PLATOS, json=datos, headers=headers())
    assert r.status_code == 409
    assert r.json() == {
        "detail": "Ya existe un plato con ese nombre",
        "code": "PRODUCTO_DUPLICADO",
    }


def test_hu04a_ca2_rechaza_renombrar_a_duplicado(
    client, headers, crear_seccion, crear_producto
):
    pastas = crear_seccion("Pastas")
    crear_producto("Ñoquis con salsa", pastas)
    ravioles = crear_producto("Ravioles", pastas)
    datos = datos_plato(pastas.id, nombre="ñoquis con salsa")
    r = client.put(f"{URL_PLATOS}/{ravioles.id}", json=datos, headers=headers())
    assert r.status_code == 409
    # Modificar el propio plato sin cambiar el nombre no es duplicado.
    r = client.put(
        f"{URL_PLATOS}/{ravioles.id}",
        json=datos_plato(pastas.id, nombre="Ravioles"),
        headers=headers(),
    )
    assert r.status_code == 200


def test_hu04a_ca2_permite_mismo_nombre_en_otro_tipo(
    client, headers, crear_seccion, crear_producto
):
    pastas = crear_seccion("Pastas")
    crear_producto("Ñoquis con salsa", pastas, tipo=TipoProducto.POSTRE)
    crear_producto("Ñoquis con salsa", pastas, activo=False)
    r = client.post(URL_PLATOS, json=datos_plato(pastas.id), headers=headers())
    assert r.status_code == 201


@pytest.mark.parametrize(
    "cambios",
    [
        {"precio": 0},
        {"precio": -1},
        {"precio": None},
        {"precio": "12.345"},
        {"nombre": "ab"},
        {"nombre": "x" * 61},
        {"descripcion": "x" * 201},
        {"porcion_gramos": 0},
        {"porcion_gramos": 1.5},
        {"seccion_id": None},
    ],
)
def test_hu04a_ca3_rechaza_datos_invalidos(client, headers, crear_seccion, cambios):
    pastas = crear_seccion("Pastas")
    datos = {**datos_plato(pastas.id), **cambios}
    datos = {k: v for k, v in datos.items() if v is not None}
    r = client.post(URL_PLATOS, json=datos, headers=headers())
    assert r.status_code == 422


def test_hu04a_ca4_sin_secciones(client, headers, crear_seccion):
    eliminada = crear_seccion("Pastas", activo=False)
    r = client.post(URL_PLATOS, json=datos_plato(eliminada.id), headers=headers())
    assert r.status_code == 422
    assert r.json() == {
        "detail": "Primero tenés que crear una sección de la carta",
        "code": "SIN_SECCIONES",
    }


def test_hu04a_ca4_seccion_inactiva(client, headers, crear_seccion):
    crear_seccion("Entradas")
    eliminada = crear_seccion("Pastas", activo=False)
    for seccion_id in [eliminada.id, 999]:
        r = client.post(URL_PLATOS, json=datos_plato(seccion_id), headers=headers())
        assert r.status_code == 422
        assert r.json()["code"] == "SECCION_INVALIDA"


def test_hu04a_ca5_cambio_de_precio_no_afecta_comanda_abierta(
    client, headers, db, crear_seccion, crear_producto, crear_comanda_con
):
    pastas = crear_seccion("Pastas")
    plato = crear_producto("Ñoquis con salsa", pastas, precio="5000")
    detalle = crear_comanda_con(plato, precio_unitario="5000")

    datos = datos_plato(pastas.id, precio=5500)
    r = client.put(f"{URL_PLATOS}/{plato.id}", json=datos, headers=headers())
    assert r.status_code == 200
    assert r.json()["precio"] == "5500.00"

    db.expire_all()
    assert db.get(Producto, plato.id).precio == Decimal("5500")
    assert db.get(DetalleComanda, detalle.id).precio_unitario == Decimal("5000")


def test_hu04a_ca6_cambia_de_seccion(client, headers, crear_seccion, crear_producto):
    minutas = crear_seccion("Minutas")
    bien_argentino = crear_seccion("Bien argentino")
    plato = crear_producto("Milanesa napolitana", minutas)

    datos = datos_plato(bien_argentino.id, nombre="Milanesa napolitana")
    r = client.put(f"{URL_PLATOS}/{plato.id}", json=datos, headers=headers())
    assert r.status_code == 200
    assert r.json()["seccion_id"] == bien_argentino.id

    def nombres_en(seccion):
        r = client.get(
            URL_PRODUCTOS, params={"seccion_id": seccion.id}, headers=headers()
        )
        return [p["nombre"] for p in r.json()]

    assert nombres_en(minutas) == []
    assert nombres_en(bien_argentino) == ["Milanesa napolitana"]


def test_hu04a_ca6_no_pasa_a_seccion_inactiva(
    client, headers, crear_seccion, crear_producto
):
    minutas = crear_seccion("Minutas")
    eliminada = crear_seccion("Vieja", activo=False)
    plato = crear_producto("Milanesa napolitana", minutas)
    datos = datos_plato(eliminada.id, nombre="Milanesa napolitana")
    r = client.put(f"{URL_PLATOS}/{plato.id}", json=datos, headers=headers())
    assert r.status_code == 422
    assert r.json()["code"] == "SECCION_INVALIDA"


def test_hu04a_ca7_elimina_plato(
    client, headers, db, crear_seccion, crear_producto, crear_comanda_con
):
    pastas = crear_seccion("Pastas")
    plato = crear_producto("Ñoquis con salsa", pastas)
    detalle = crear_comanda_con(plato, cerrada=True)

    r = client.delete(f"{URL_PRODUCTOS}/{plato.id}", headers=headers())
    assert r.status_code == 204
    assert client.get(URL_PRODUCTOS, headers=headers()).json() == []
    r = client.get(f"{URL_PRODUCTOS}/{plato.id}", headers=headers())
    assert r.status_code == 404

    db.expire_all()
    assert db.get(Producto, plato.id).activo is False
    assert db.get(DetalleComanda, detalle.id).producto_id == plato.id


def test_hu04a_ca8_bloquea_si_esta_en_comanda_abierta(
    client, headers, crear_seccion, crear_producto, crear_comanda_con
):
    pastas = crear_seccion("Pastas")
    plato = crear_producto("Ñoquis con salsa", pastas)
    crear_comanda_con(plato)
    crear_comanda_con(plato)

    r = client.delete(f"{URL_PRODUCTOS}/{plato.id}", headers=headers())
    assert r.status_code == 409
    assert r.json() == {
        "detail": "No se puede eliminar Ñoquis con salsa: está en 2 comandas abiertas",
        "code": "PRODUCTO_EN_USO",
    }


def test_hu04a_ca8_comanda_facturada_no_bloquea(
    client, headers, crear_seccion, crear_producto, crear_comanda_con
):
    pastas = crear_seccion("Pastas")
    plato = crear_producto("Ñoquis con salsa", pastas)
    crear_comanda_con(plato, cerrada=True)
    r = client.delete(f"{URL_PRODUCTOS}/{plato.id}", headers=headers())
    assert r.status_code == 204


def test_hu04a_producto_inexistente_404(client, headers, crear_seccion):
    pastas = crear_seccion("Pastas")
    r = client.get(f"{URL_PRODUCTOS}/999", headers=headers())
    assert r.status_code == 404
    assert r.json()["code"] == "PRODUCTO_NO_ENCONTRADO"
    r = client.put(f"{URL_PLATOS}/999", json=datos_plato(pastas.id), headers=headers())
    assert r.status_code == 404
    r = client.delete(f"{URL_PRODUCTOS}/999", headers=headers())
    assert r.status_code == 404


def test_hu04a_put_sobre_otro_tipo_404(client, headers, crear_seccion, crear_producto):
    bebidas = crear_seccion("Bebidas")
    bebida = crear_producto("Agua mineral", bebidas, tipo=TipoProducto.BEBIDA)
    datos = datos_plato(bebidas.id, nombre="Agua mineral")
    r = client.put(f"{URL_PLATOS}/{bebida.id}", json=datos, headers=headers())
    assert r.status_code == 404
    assert r.json()["code"] == "PRODUCTO_NO_ENCONTRADO"


def test_hu04a_lista_con_filtros_ordenado_por_nombre(
    client, headers, crear_seccion, crear_producto
):
    pastas = crear_seccion("Pastas")
    postres = crear_seccion("Postres")
    crear_producto("Ravioles", pastas)
    crear_producto("ñoquis", pastas)
    crear_producto("Canelones", pastas)
    crear_producto("Flan", postres, tipo=TipoProducto.POSTRE)

    r = client.get(URL_PRODUCTOS, headers=headers())
    assert [p["nombre"] for p in r.json()] == [
        "Canelones",
        "Flan",
        "ñoquis",
        "Ravioles",
    ]
    r = client.get(URL_PRODUCTOS, params={"tipo": "POSTRE"}, headers=headers())
    assert [p["nombre"] for p in r.json()] == ["Flan"]


def test_hu04a_mozo_no_puede_crear(client, headers, crear_seccion):
    pastas = crear_seccion("Pastas")
    r = client.post(URL_PLATOS, json=datos_plato(pastas.id), headers=headers(Rol.MOZO))
    assert r.status_code == 403
    r = client.get(URL_PRODUCTOS, headers=headers(Rol.MOZO))
    assert r.status_code == 403
