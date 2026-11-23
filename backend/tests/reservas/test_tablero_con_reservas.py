"""Tablero de mesas con reservas para hoy: la mesa sigue usable hasta la llegada.

La reserva activa de hoy viaja en `reserva_hoy` como aviso; el estado operativo
ya no es "reservada". Registrar la llegada con la mesa ocupada sigue bloqueado.
"""

from datetime import date, datetime, time, timedelta

from app.core.enums import EstadoReserva, Rol
from app.models.personal import Mozo

URL_COMANDAS = "/api/v1/comandas"
URL_RESERVAS = "/api/v1/reservas"


def _dentro_de_hoy() -> timedelta:
    """Offset para una reserva dentro de ~2 h, sin cruzar la medianoche."""
    ahora = datetime.now()
    objetivo = min(
        ahora + timedelta(hours=2), datetime.combine(date.today(), time(23, 59))
    )
    return objetivo - ahora


def _mozo(db, salon) -> Mozo:
    mozo = Mozo(
        dni="12345678",
        nombre="Ana",
        apellido="Ruiz",
        sector_id=salon[1].sector_id,
    )
    db.add(mozo)
    db.commit()
    return mozo


def _mesa(tablero: list[dict], numero: int) -> dict:
    return next(m for m in tablero if m["numero"] == numero)


def test_tablero_mesa_con_reserva_hoy_sigue_libre_y_muestra_la_reserva(
    client, headers, reserva_en
):
    reserva = reserva_en(_dentro_de_hoy())
    client.headers.update(headers(Rol.ADMINISTRADOR))

    tablero = client.get(f"{URL_COMANDAS}/tablero-mesas").json()
    mesa1 = _mesa(tablero, 1)
    assert mesa1["estado_mesa"] == "libre"
    assert mesa1["comanda"] is None
    assert mesa1["reserva_hoy"]["id"] == reserva.id
    assert mesa1["reserva_hoy"]["cliente"] == "Gómez, Laura"
    assert mesa1["reserva_hoy"]["cantidad_comensales"] == 2

    # Las mesas sin reserva para hoy no traen aviso.
    assert _mesa(tablero, 2)["reserva_hoy"] is None


def test_recepcion_y_caja_ven_el_tablero_pero_no_abren_comandas(
    db, client, headers, salon
):
    """Recepción consulta el tablero; ninguno de los dos puede operar comandas."""
    _mozo(db, salon)
    for rol in (Rol.RECEPCIONISTA, Rol.CAJERO):
        client.headers.update(headers(rol))
        assert client.get(f"{URL_COMANDAS}/tablero-mesas").status_code == 200
        r = client.post(
            URL_COMANDAS,
            json={
                "dni_mozo": "12345678",
                "cantidad_comensales": 2,
                "numeros_mesa": [1],
            },
        )
        assert r.status_code == 403


def test_se_puede_abrir_comanda_en_mesa_con_reserva_hoy(
    db, client, headers, salon, reserva_en
):
    _mozo(db, salon)
    reserva = reserva_en(_dentro_de_hoy())
    client.headers.update(headers(Rol.MOZO))

    r = client.post(
        URL_COMANDAS,
        json={
            "dni_mozo": "12345678",
            "cantidad_comensales": 2,
            "numeros_mesa": [1],
        },
    )
    assert r.status_code == 201

    tablero = client.get(f"{URL_COMANDAS}/tablero-mesas").json()
    mesa1 = _mesa(tablero, 1)
    assert mesa1["estado_mesa"] == "ocupada"
    assert mesa1["comanda"]["id"] == r.json()["id"]
    # El aviso de reserva sigue visible aunque la mesa esté ocupada.
    assert mesa1["reserva_hoy"]["id"] == reserva.id


def test_llegada_con_mesa_ocupada_se_bloquea(db, client, headers, salon, reserva_en):
    _mozo(db, salon)
    reserva = reserva_en(_dentro_de_hoy())
    client.headers.update(headers(Rol.MOZO))
    assert (
        client.post(
            URL_COMANDAS,
            json={
                "dni_mozo": "12345678",
                "cantidad_comensales": 2,
                "numeros_mesa": [1],
            },
        ).status_code
        == 201
    )

    client.headers.update(headers(Rol.RECEPCIONISTA))
    r = client.post(f"{URL_RESERVAS}/{reserva.id}/llegada")
    assert r.status_code == 409
    assert r.json()["code"] == "MESA_OCUPADA"
    db.refresh(reserva)
    assert reserva.estado == EstadoReserva.ACTIVA
