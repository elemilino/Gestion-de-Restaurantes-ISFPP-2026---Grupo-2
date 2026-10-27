"""Pruebas de HU-03b: ver la carta."""

import time
from decimal import Decimal

from app.core.enums import Rol, TipoProducto
from app.models.carta import Producto, SeccionCarta

URL = "/api/v1/carta"


def nombres_por_seccion(carta: dict) -> list[tuple[str, list[str]]]:
    return [
        (s["nombre"], [p["nombre"] for p in s["productos"]]) for s in carta["secciones"]
    ]


def test_hu03b_ca1_agrupa_por_seccion_en_orden(
    client, headers, crear_seccion, crear_producto
):
    postres = crear_seccion("Postres", orden=3)
    entradas = crear_seccion("Entradas", orden=1)
    pastas = crear_seccion("Pastas", orden=2)
    crear_producto("Flan casero", postres, tipo=TipoProducto.POSTRE)
    crear_producto("Empanada de carne", entradas, precio="1200")
    crear_producto("Ñoquis con salsa", pastas, descripcion="Con fileto")

    r = client.get(URL, headers=headers(Rol.MOZO))
    assert r.status_code == 200
    carta = r.json()
    assert nombres_por_seccion(carta) == [
        ("Entradas", ["Empanada de carne"]),
        ("Pastas", ["Ñoquis con salsa"]),
        ("Postres", ["Flan casero"]),
    ]
    assert [s["orden"] for s in carta["secciones"]] == [1, 2, 3]
    empanada = carta["secciones"][0]["productos"][0]
    assert empanada["precio"] == "1200.00"
    assert empanada["tipo"] == "PLATO"
    assert empanada["disponible"] is True
    assert "stock" not in empanada
    assert "activo" not in empanada
    assert carta["secciones"][1]["productos"][0]["descripcion"] == "Con fileto"


def test_hu03b_ca1_mozo_puede_ver_la_carta(client, headers, crear_seccion):
    crear_seccion("Entradas")
    assert client.get(URL, headers=headers(Rol.MOZO)).status_code == 200
    assert client.get(URL, headers=headers(Rol.ADMINISTRADOR)).status_code == 200
    assert client.get(URL).status_code == 401


def test_hu03b_ca2_filtra_por_seccion_ordenado_por_nombre(
    client, headers, crear_seccion, crear_producto
):
    entradas = crear_seccion("Entradas")
    pastas = crear_seccion("Pastas")
    crear_producto("Empanada de carne", entradas)
    for nombre in ["Ravioles", "ñoquis", "Canelones"]:
        crear_producto(nombre, pastas)

    r = client.get(URL, params={"seccion_id": pastas.id}, headers=headers(Rol.MOZO))
    assert r.status_code == 200
    assert nombres_por_seccion(r.json()) == [
        ("Pastas", ["Canelones", "ñoquis", "Ravioles"])
    ]


def test_hu03b_ca2_seccion_inexistente_404(client, headers, crear_seccion):
    eliminada = crear_seccion("Vieja", activo=False)
    for seccion_id in [999, eliminada.id]:
        r = client.get(URL, params={"seccion_id": seccion_id}, headers=headers())
        assert r.status_code == 404
        assert r.json()["code"] == "SECCION_NO_ENCONTRADA"


def test_hu03b_ca3_no_muestra_eliminados(
    client, headers, crear_seccion, crear_producto
):
    pastas = crear_seccion("Pastas")
    crear_producto("Ñoquis con salsa", pastas)
    crear_producto("Ravioles", pastas, activo=False)
    r = client.get(URL, headers=headers(Rol.MOZO))
    assert nombres_por_seccion(r.json()) == [("Pastas", ["Ñoquis con salsa"])]


def test_hu03b_ca4_marca_no_disponibles(client, headers, crear_seccion, crear_producto):
    postres = crear_seccion("Postres")
    crear_producto("Panqueque", postres, disponible=False)
    crear_producto("Bife de chorizo", postres, stock=0)
    crear_producto("Flan casero", postres, stock=5)
    crear_producto("Helado", postres)

    r = client.get(URL, headers=headers(Rol.MOZO))
    productos = r.json()["secciones"][0]["productos"]
    assert {p["nombre"]: p["disponible"] for p in productos} == {
        "Bife de chorizo": False,
        "Flan casero": True,
        "Helado": True,
        "Panqueque": False,
    }


def test_hu03b_ca4_muestra_datos_propios_de_bebida(
    client, headers, crear_seccion, crear_producto
):
    cervezas = crear_seccion("Cervezas")
    crear_producto(
        "Cerveza tirada",
        cervezas,
        tipo=TipoProducto.BEBIDA,
        volumen_ml=500,
        alcoholica=True,
    )
    producto = client.get(URL, headers=headers()).json()["secciones"][0]["productos"][0]
    assert producto["volumen_ml"] == 500
    assert producto["alcoholica"] is True
    assert producto["porcion_gramos"] is None


def test_hu03b_ca5_omite_secciones_vacias(
    client, headers, crear_seccion, crear_producto
):
    entradas = crear_seccion("Entradas")
    vacia = crear_seccion("Pastas")
    solo_inactivos = crear_seccion("Postres")
    crear_producto("Empanada de carne", entradas)
    crear_producto("Flan casero", solo_inactivos, activo=False)

    r = client.get(URL, headers=headers(Rol.MOZO))
    assert [s["nombre"] for s in r.json()["secciones"]] == ["Entradas"]
    r = client.get(URL, params={"seccion_id": vacia.id}, headers=headers(Rol.MOZO))
    assert r.status_code == 200
    assert r.json() == {"secciones": []}


def test_hu03b_ca5_carta_vacia(client, headers, crear_seccion):
    crear_seccion("Entradas")
    r = client.get(URL, headers=headers(Rol.MOZO))
    assert r.status_code == 200
    assert r.json() == {"secciones": []}


def test_hu03b_ca5_seccion_inactiva_no_aparece(
    client, headers, crear_seccion, crear_producto
):
    entradas = crear_seccion("Entradas")
    vieja = crear_seccion("Vieja", activo=False)
    crear_producto("Empanada de carne", entradas)
    crear_producto("Plato viejo", vieja, activo=False)
    r = client.get(URL, headers=headers(Rol.MOZO))
    assert [s["nombre"] for s in r.json()["secciones"]] == ["Entradas"]


def test_hu03b_ca6_responde_rapido_con_carta_completa(client, headers, db):
    for i in range(20):
        seccion = SeccionCarta(nombre=f"Sección {i:02d}", orden=i + 1)
        db.add(seccion)
        db.flush()
        db.add_all(
            Producto(
                nombre=f"Producto {i:02d}-{j:02d}",
                descripcion="Descripción de prueba",
                precio=Decimal("1000"),
                tipo=TipoProducto.PLATO,
                seccion_id=seccion.id,
                stock=j % 3,
            )
            for j in range(25)
        )
    db.commit()
    h = headers(Rol.MOZO)

    inicio = time.perf_counter()
    r = client.get(URL, headers=h)
    duracion = time.perf_counter() - inicio

    assert r.status_code == 200
    secciones = r.json()["secciones"]
    assert len(secciones) == 20
    assert sum(len(s["productos"]) for s in secciones) == 500
    assert duracion < 2
