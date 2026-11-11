"""HU-09b: menús especiales (ejecutivo y del día) y su efecto en la carta."""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.core.enums import EstadoReserva, Rol, TipoProducto
from app.models.carta import Producto
from app.models.reservas import DetalleMenuAcordado, MenuAcordado, Reserva

URL = "/api/v1/carta"
HOY = date.today()


@pytest.fixture
def carta(crear_seccion, crear_producto):
    """Sección de menús, un plato, un postre y una bebida."""
    menus = crear_seccion("Menús")
    minutas = crear_seccion("Minutas")
    return {
        "seccion": menus,
        "plato": crear_producto("Milanesa", minutas),
        "postre": crear_producto("Flan", minutas, tipo=TipoProducto.POSTRE),
        "bebida": crear_producto(
            "Gaseosa", minutas, tipo=TipoProducto.BEBIDA, volumen_ml=500
        ),
    }


@pytest.fixture(autouse=True)
def sesion_cocinero(client, headers):
    client.headers.update(headers(Rol.COCINERO))


def _ejecutivo(carta, **cambios) -> dict:
    datos = {
        "nombre": "Ejecutivo del mediodía",
        "precio": "9000",
        "seccion_id": carta["seccion"].id,
        "plato_id": carta["plato"].id,
        "postre_id": carta["postre"].id,
        "fecha_inicio": HOY.isoformat(),
        "fecha_fin": (HOY + timedelta(days=6)).isoformat(),
    }
    datos.update(cambios)
    return datos


def _del_dia(carta, **cambios) -> dict:
    datos = _ejecutivo(carta, **{"nombre": "Menú del día", "precio": "6000", **cambios})
    datos.pop("postre_id")
    return datos


# --- Menú ejecutivo ---


def test_hu09b_ejecutivo_ca1_crea_el_menu(client, carta):
    r = client.post(f"{URL}/menus-ejecutivos", json=_ejecutivo(carta))
    assert r.status_code == 201
    cuerpo = r.json()
    assert cuerpo["tipo"] == "MENU_EJECUTIVO"
    assert cuerpo["plato"]["nombre"] == "Milanesa"
    assert cuerpo["postre"]["nombre"] == "Flan"
    assert cuerpo["precio"] == "9000.00"
    assert cuerpo["vigente"] is True


def test_hu09b_ejecutivo_ca2_la_bebida_no_forma_parte_del_menu(client, carta):
    # Un campo de bebida se ignora: el menú queda solo con plato y postre.
    datos = _ejecutivo(carta, bebida_id=carta["bebida"].id)
    r = client.post(f"{URL}/menus-ejecutivos", json=datos)
    assert r.status_code == 201
    assert "bebida" not in r.json()
    # Y una bebida en lugar del postre se rechaza.
    datos = _ejecutivo(carta, nombre="Otro ejecutivo", postre_id=carta["bebida"].id)
    r = client.post(f"{URL}/menus-ejecutivos", json=datos)
    assert r.status_code == 422
    assert r.json()["code"] == "MENU_COMPONENTE_INVALIDO"


def test_hu09b_ejecutivo_ca3_modifica_el_menu(client, carta):
    menu = client.post(f"{URL}/menus-ejecutivos", json=_ejecutivo(carta)).json()
    r = client.put(
        f"{URL}/menus-ejecutivos/{menu['id']}", json=_ejecutivo(carta, precio="9500")
    )
    assert r.status_code == 200
    assert r.json()["precio"] == "9500.00"


def test_hu09b_ejecutivo_ca4_elimina_con_baja_logica(db, client, carta):
    menu = client.post(f"{URL}/menus-ejecutivos", json=_ejecutivo(carta)).json()
    assert client.delete(f"{URL}/menus/{menu['id']}").status_code == 204
    assert client.get(f"{URL}/menus").json() == []
    assert db.get(Producto, menu["id"]).activo is False


# --- Menú del día ---


def test_hu09b_del_dia_ca1_crea_el_menu(client, carta):
    r = client.post(f"{URL}/menus-del-dia", json=_del_dia(carta))
    assert r.status_code == 201
    assert r.json()["tipo"] == "MENU_DEL_DIA"
    assert r.json()["postre"] is None


def test_hu09b_del_dia_ca2_modifica_el_menu(client, carta):
    menu = client.post(f"{URL}/menus-del-dia", json=_del_dia(carta)).json()
    fin = (HOY + timedelta(days=1)).isoformat()
    r = client.put(
        f"{URL}/menus-del-dia/{menu['id']}", json=_del_dia(carta, fecha_fin=fin)
    )
    assert r.status_code == 200
    assert r.json()["fecha_fin"] == fin


def test_hu09b_del_dia_ca3_elimina_el_menu(client, carta):
    menu = client.post(f"{URL}/menus-del-dia", json=_del_dia(carta)).json()
    assert client.delete(f"{URL}/menus/{menu['id']}").status_code == 204
    assert client.get(f"{URL}/menus").json() == []


# --- Validaciones y permisos ---


def test_hu09b_plato_tiene_que_ser_un_plato_activo(client, carta):
    r = client.post(
        f"{URL}/menus-del-dia", json=_del_dia(carta, plato_id=carta["postre"].id)
    )
    assert r.status_code == 422
    assert r.json()["code"] == "MENU_COMPONENTE_INVALIDO"


def test_hu09b_vigencia_invalida(client, carta):
    datos = _del_dia(carta, fecha_fin=(HOY - timedelta(days=1)).isoformat())
    assert client.post(f"{URL}/menus-del-dia", json=datos).status_code == 422


def test_hu09b_nombre_duplicado(client, carta):
    client.post(f"{URL}/menus-del-dia", json=_del_dia(carta))
    r = client.post(f"{URL}/menus-del-dia", json=_del_dia(carta))
    assert r.status_code == 409
    assert r.json()["code"] == "PRODUCTO_DUPLICADO"


def test_hu09b_permisos(client, headers, carta):
    client.headers.update(headers(Rol.ENCARGADO_GENERAL))
    assert client.post(f"{URL}/menus-del-dia", json=_del_dia(carta)).status_code == 201
    client.headers.update(headers(Rol.MOZO))
    assert client.get(f"{URL}/menus").status_code == 403


# --- Efecto en la carta y en otras HU ---


def test_hu09b_ver_carta_muestra_solo_los_menus_vigentes(client, headers, carta):
    client.post(f"{URL}/menus-del-dia", json=_del_dia(carta))
    futuro = (HOY + timedelta(days=3)).isoformat()
    client.post(
        f"{URL}/menus-del-dia",
        json=_del_dia(
            carta,
            nombre="Menú de la semana que viene",
            fecha_inicio=futuro,
            fecha_fin=futuro,
        ),
    )
    client.headers.update(headers(Rol.MOZO))
    secciones = client.get(URL).json()["secciones"]
    menus = next(s for s in secciones if s["nombre"] == "Menús")
    assert [p["nombre"] for p in menus["productos"]] == ["Menú del día"]


def test_hu04a_ca8_plato_en_un_menu_vigente_no_se_elimina(client, headers, carta):
    client.post(f"{URL}/menus-ejecutivos", json=_ejecutivo(carta))
    client.headers.update(headers(Rol.ADMINISTRADOR))
    r = client.delete(f"{URL}/productos/{carta['plato'].id}")
    assert r.status_code == 409
    assert "menú vigente Ejecutivo del mediodía" in r.json()["detail"]


def test_hu04a_ca8_plato_en_menu_acordado_de_reserva_activa_no_se_elimina(
    db, client, headers, carta
):
    reserva = Reserva(
        fecha_hora=datetime.now() + timedelta(days=1),
        cantidad_comensales=2,
        estado=EstadoReserva.ACTIVA,
        menu_acordado=MenuAcordado(
            detalles=[
                DetalleMenuAcordado(
                    producto_id=carta["plato"].id, cantidad=2, precio=Decimal("4000")
                )
            ]
        ),
    )
    db.add(reserva)
    db.commit()
    client.headers.update(headers(Rol.ADMINISTRADOR))
    r = client.delete(f"{URL}/productos/{carta['plato'].id}")
    assert r.status_code == 409
    assert "menú acordado de 1 reservas activas" in r.json()["detail"]
