"""HU-05a CA8: crear la comanda a partir de una reserva Cumplida."""

from datetime import timedelta
from decimal import Decimal

import pytest

from app.core.enums import EstadoReserva, Rol
from app.models.personal import Mozo
from app.models.reservas import DetalleMenuAcordado, MenuAcordado

URL = "/api/v1/comandas"


@pytest.fixture
def mozo(db, salon) -> Mozo:
    m = Mozo(
        dni="12345678",
        nombre="Ana",
        apellido="Ruiz",
        sector_id=salon[1].sector_id,
    )
    db.add(m)
    db.commit()
    return m


@pytest.fixture(autouse=True)
def sesion_mozo(client, headers):
    client.headers.update(headers(Rol.MOZO))


def _crear(client, reserva_id):
    return client.post(URL, json={"dni_mozo": "12345678", "reserva_id": reserva_id})


def test_hu05a_ca8_crea_la_comanda_con_mesas_y_comensales_de_la_reserva(
    client, mozo, reserva_en
):
    reserva = reserva_en(-timedelta(minutes=5), estado=EstadoReserva.CUMPLIDA)
    r = _crear(client, reserva.id)
    assert r.status_code == 201
    cuerpo = r.json()
    assert cuerpo["estado"] == "ABIERTA"
    assert cuerpo["reserva_id"] == reserva.id
    assert [m["numero"] for m in cuerpo["mesas"]] == [1]
    assert cuerpo["cantidad_comensales"] == 2


def test_hu05a_ca8_carga_el_menu_acordado_con_su_precio(
    db, client, mozo, reserva_en, plato
):
    reserva = reserva_en(-timedelta(minutes=5), estado=EstadoReserva.CUMPLIDA)
    reserva.menu_acordado = MenuAcordado(
        detalles=[
            DetalleMenuAcordado(
                producto_id=plato.id, cantidad=2, precio=Decimal("4500")
            )
        ]
    )
    db.commit()
    detalles = _crear(client, reserva.id).json()["detalles"]
    assert [
        (d["producto"]["nombre"], d["cantidad"], d["precio_unitario"]) for d in detalles
    ] == [("Ñoquis", 2, "4500.00")]


def test_hu05a_ca8_la_reserva_tiene_que_estar_cumplida(client, mozo, reserva_en):
    reserva = reserva_en(timedelta(hours=1))
    r = _crear(client, reserva.id)
    assert r.status_code == 422
    assert r.json()["code"] == "RESERVA_NO_CUMPLIDA"


def test_hu05a_ca8_una_sola_comanda_por_reserva(client, mozo, reserva_en):
    reserva = reserva_en(-timedelta(minutes=5), estado=EstadoReserva.CUMPLIDA)
    assert _crear(client, reserva.id).status_code == 201
    r = _crear(client, reserva.id)
    assert r.status_code == 409
    assert r.json()["code"] == "RESERVA_CON_COMANDA"
