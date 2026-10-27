"""Pruebas de HU-03a: gestión de secciones de la carta."""

import pytest

from app.core.enums import Rol
from app.models.carta import Producto

URL = "/api/v1/carta/secciones"


def test_hu03a_ca1_crea_seccion_al_final(client, headers, crear_seccion):
    crear_seccion("Entradas", orden=1)
    r = client.post(URL, json={"nombre": "Pastas"}, headers=headers())
    assert r.status_code == 201
    datos = r.json()
    assert datos["orden"] == 2
    assert datos["cantidad_productos"] == 0
    nombres = [s["nombre"] for s in client.get(URL, headers=headers()).json()]
    assert nombres == ["Entradas", "Pastas"]


def test_hu03a_ca1_respeta_orden_indicado(client, headers):
    r = client.post(URL, json={"nombre": "Postres", "orden": 5}, headers=headers())
    assert r.status_code == 201
    assert r.json()["orden"] == 5


def test_hu03a_ca2_rechaza_duplicado_sin_mayusculas(client, headers, crear_seccion):
    crear_seccion("Entradas")
    r = client.post(URL, json={"nombre": "entradas"}, headers=headers())
    assert r.status_code == 409
    assert r.json() == {
        "detail": "Ya existe una sección con ese nombre",
        "code": "SECCION_DUPLICADA",
    }


def test_hu03a_ca2_rechaza_renombrar_a_duplicado(client, headers, crear_seccion):
    crear_seccion("Entradas", orden=1)
    pastas = crear_seccion("Pastas", orden=2)
    r = client.put(
        f"{URL}/{pastas.id}", json={"nombre": "ENTRADAS", "orden": 2}, headers=headers()
    )
    assert r.status_code == 409
    assert r.json()["code"] == "SECCION_DUPLICADA"


def test_hu03a_ca2_permite_nombre_de_seccion_eliminada(client, headers, crear_seccion):
    crear_seccion("Postres", activo=False)
    r = client.post(URL, json={"nombre": "Postres"}, headers=headers())
    assert r.status_code == 201


@pytest.mark.parametrize("nombre", ["", "ab", "x" * 51, "   "])
def test_hu03a_ca3_rechaza_nombre_invalido(client, headers, nombre):
    r = client.post(URL, json={"nombre": nombre}, headers=headers())
    assert r.status_code == 422


def test_hu03a_ca3_rechaza_orden_invalido(client, headers):
    r = client.post(URL, json={"nombre": "Pastas", "orden": 0}, headers=headers())
    assert r.status_code == 422


def test_hu03a_ca4_modifica_y_conserva_productos(
    client, headers, db, crear_seccion, crear_producto
):
    crear_seccion("Entradas", orden=1)
    pastas = crear_seccion("Pastas", orden=2)
    producto = crear_producto("Ñoquis", pastas)

    r = client.put(
        f"{URL}/{pastas.id}",
        json={"nombre": "Pastas caseras", "orden": 1},
        headers=headers(),
    )
    assert r.status_code == 200
    assert r.json()["nombre"] == "Pastas caseras"
    assert r.json()["orden"] == 1
    assert r.json()["cantidad_productos"] == 1

    db.expire_all()
    assert db.get(Producto, producto.id).seccion_id == pastas.id
    # Mismo orden 1: desempata el nombre ("Entradas" < "Pastas caseras").
    listado = client.get(URL, headers=headers()).json()
    assert [s["nombre"] for s in listado] == ["Entradas", "Pastas caseras"]


def test_hu03a_ca4_nuevo_orden_cambia_el_listado(client, headers, crear_seccion):
    entradas = crear_seccion("Entradas", orden=1)
    crear_seccion("Pastas", orden=2)
    r = client.put(
        f"{URL}/{entradas.id}",
        json={"nombre": "Entradas", "orden": 3},
        headers=headers(),
    )
    assert r.status_code == 200
    listado = client.get(URL, headers=headers()).json()
    assert [s["nombre"] for s in listado] == ["Pastas", "Entradas"]


def test_hu03a_ca5_elimina_seccion_vacia(client, headers, crear_seccion):
    crear_seccion("Entradas")
    pastas = crear_seccion("Pastas")
    r = client.delete(f"{URL}/{pastas.id}", headers=headers())
    assert r.status_code == 204
    nombres = [s["nombre"] for s in client.get(URL, headers=headers()).json()]
    assert nombres == ["Entradas"]


def test_hu03a_ca6_bloquea_si_tiene_productos(
    client, headers, crear_seccion, crear_producto
):
    crear_seccion("Entradas")
    pastas = crear_seccion("Pastas")
    for nombre in ["Ñoquis", "Ravioles", "Lasaña"]:
        crear_producto(nombre, pastas)
    r = client.delete(f"{URL}/{pastas.id}", headers=headers())
    assert r.status_code == 409
    assert r.json()["code"] == "SECCION_CON_PRODUCTOS"
    assert r.json()["detail"] == (
        "No se puede eliminar la sección Pastas: tiene 3 productos activos"
    )


def test_hu03a_ca6_productos_inactivos_no_bloquean(
    client, headers, crear_seccion, crear_producto
):
    crear_seccion("Entradas")
    pastas = crear_seccion("Pastas")
    crear_producto("Ñoquis", pastas, activo=False)
    r = client.delete(f"{URL}/{pastas.id}", headers=headers())
    assert r.status_code == 204


def test_hu03a_ca6_bloquea_unica_seccion(client, headers, crear_seccion):
    crear_seccion("Eliminada", activo=False)
    entradas = crear_seccion("Entradas")
    r = client.delete(f"{URL}/{entradas.id}", headers=headers())
    assert r.status_code == 409
    assert r.json() == {
        "detail": "No se puede eliminar la única sección activa de la carta",
        "code": "SECCION_UNICA",
    }


def test_hu03a_ca7_lista_en_orden_con_cantidad(
    client, headers, crear_seccion, crear_producto
):
    postres = crear_seccion("Postres", orden=3)
    entradas = crear_seccion("Entradas", orden=1)
    pastas = crear_seccion("Pastas", orden=2)
    crear_seccion("Vieja", orden=0, activo=False)
    crear_producto("Empanada", entradas)
    crear_producto("Provoleta", entradas)
    crear_producto("Ñoquis", pastas)
    crear_producto("Ravioles", pastas, activo=False)
    crear_producto("Flan", postres, activo=False)

    r = client.get(URL, headers=headers())
    assert r.status_code == 200
    assert [(s["nombre"], s["orden"], s["cantidad_productos"]) for s in r.json()] == [
        ("Entradas", 1, 2),
        ("Pastas", 2, 1),
        ("Postres", 3, 0),
    ]


def test_hu03a_seccion_inexistente_404(client, headers, crear_seccion):
    eliminada = crear_seccion("Vieja", activo=False)
    for seccion_id in [999, eliminada.id]:
        r = client.put(
            f"{URL}/{seccion_id}",
            json={"nombre": "Nueva", "orden": 1},
            headers=headers(),
        )
        assert r.status_code == 404
        assert r.json()["code"] == "SECCION_NO_ENCONTRADA"
        r = client.delete(f"{URL}/{seccion_id}", headers=headers())
        assert r.status_code == 404
        assert r.json()["code"] == "SECCION_NO_ENCONTRADA"


def test_hu03a_mozo_no_puede_gestionar(client, headers):
    r = client.post(URL, json={"nombre": "Entradas"}, headers=headers(Rol.MOZO))
    assert r.status_code == 403
    r = client.get(URL, headers=headers(Rol.MOZO))
    assert r.status_code == 403
