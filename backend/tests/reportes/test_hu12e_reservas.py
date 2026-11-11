"""HU-12e: reporte de reservas por estado y clientes con más ausencias."""

from decimal import Decimal

import pytest

from app.core.enums import EstadoReserva
from app.models.clientes import Cliente
from app.models.reservas import Reserva, Sena

URL = "/api/v1/reportes/reservas"


@pytest.fixture
def clientes(db):
    lista = [
        Cliente(nombre=n, apellido=a, telefono="2804000000", dni=d)
        for n, a, d in (
            ("Laura", "Gómez", "30000001"),
            ("Martín", "Díaz", "30000002"),
            ("Sofía", "Herrera", "30000003"),
            ("Pablo", "Ríos", "30000004"),
        )
    ]
    db.add_all(lista)
    db.commit()
    return lista


@pytest.fixture
def reserva(db, base):
    def _crear(cliente, cuando, estado, sena="5000", devuelta=False) -> Reserva:
        r = Reserva(
            fecha_hora=cuando,
            cantidad_comensales=2,
            cliente_id=cliente.id,
            estado=estado,
            mesas=[base["mesas"][1]],
            sena=Sena(
                monto=Decimal(sena),
                medio_pago_id=base["efectivo"].id,
                devuelta=devuelta,
            ),
        )
        db.add(r)
        db.commit()
        return r

    return _crear


def test_hu12e_ca1_cantidad_y_porcentaje_por_estado(
    client, clientes, reserva, hace, periodo
):
    laura = clientes[0]
    for estado in EstadoReserva:
        reserva(laura, hace(3), estado)
    cuerpo = client.get(URL, params=periodo(5)).json()
    assert cuerpo["total_reservas"] == 4
    assert {
        e["estado"]: (e["cantidad"], e["porcentaje"]) for e in cuerpo["por_estado"]
    } == {
        "ACTIVA": (1, 25.0),
        "CUMPLIDA": (1, 25.0),
        "CANCELADA": (1, 25.0),
        "AUSENTE": (1, 25.0),
    }


def test_hu12e_ca2_clientes_con_mas_ausencias(client, clientes, reserva, hace, periodo):
    laura, martin, sofia, pablo = clientes
    ausente = EstadoReserva.AUSENTE
    reserva(laura, hace(4), ausente)
    reserva(laura, hace(3), ausente)
    reserva(laura, hace(2), EstadoReserva.CUMPLIDA)
    reserva(martin, hace(4), ausente)
    reserva(sofia, hace(2), ausente)  # empata con Martín, pero es más reciente
    reserva(pablo, hace(2), EstadoReserva.CUMPLIDA)  # sin ausencias: no aparece
    ausentes = client.get(URL, params=periodo(5)).json()["clientes_ausentes"]
    assert [(c["nombre"], c["ausencias"], c["total_reservas"]) for c in ausentes] == [
        ("Laura", 2, 3),
        ("Sofía", 1, 1),
        ("Martín", 1, 1),
    ]
    assert ausentes[0]["dni"] == "30000001"


def test_hu12e_ca3_senas_retenidas(client, clientes, reserva, hace, periodo):
    laura = clientes[0]
    reserva(laura, hace(3), EstadoReserva.AUSENTE, sena="7000")
    reserva(laura, hace(3), EstadoReserva.AUSENTE, sena="2000", devuelta=True)
    reserva(laura, hace(3), EstadoReserva.CANCELADA, sena="4000", devuelta=True)
    assert client.get(URL, params=periodo(5)).json()["senas_retenidas"] == "7000.00"


def test_hu12e_ca4_cliente_dado_de_baja_sigue_apareciendo(
    db, client, clientes, reserva, hace, periodo
):
    laura = clientes[0]
    reserva(laura, hace(3), EstadoReserva.AUSENTE)
    laura.activo = False
    db.commit()
    cliente = client.get(URL, params=periodo(5)).json()["clientes_ausentes"][0]
    assert cliente["dado_de_baja"] is True


def test_hu12e_ca5_sin_datos_o_periodo_invalido(client, base, periodo):
    cuerpo = client.get(URL, params=periodo(5)).json()
    assert cuerpo["mensaje"] == "No hay reservas en el período seleccionado"
    assert client.get(URL, params=periodo(1, 5)).json()["code"] == "PERIODO_INVALIDO"
