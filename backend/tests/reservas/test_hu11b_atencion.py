"""HU-11b: atención de reservas (llegada y ausencia con 15 min de tolerancia)."""

from datetime import timedelta

from app.core.enums import EstadoReserva

URL = "/api/v1/reservas"


def test_hu11b_ca1_llegada_pasa_a_cumplida(client, reserva_en):
    reserva = reserva_en(timedelta(minutes=10))
    r = client.post(f"{URL}/{reserva.id}/llegada")
    assert r.status_code == 200
    assert r.json()["estado"] == "CUMPLIDA"
    assert r.json()["fecha_hora_llegada"] is not None


def test_hu11b_ca2_ausencia_despues_de_la_tolerancia(client, reserva_en):
    reserva = reserva_en(-timedelta(minutes=20))
    r = client.post(f"{URL}/{reserva.id}/ausencia")
    assert r.status_code == 200
    assert r.json()["estado"] == "AUSENTE"
    assert r.json()["sena"]["devuelta"] is False


def test_hu11b_ca3_ausencia_antes_de_la_tolerancia(client, reserva_en):
    reserva = reserva_en(-timedelta(minutes=5))
    r = client.post(f"{URL}/{reserva.id}/ausencia")
    assert r.status_code == 422
    assert r.json()["code"] == "TOLERANCIA_NO_VENCIDA"
    assert "faltan 10 minutos" in r.json()["detail"]


def test_hu11b_ca4_reserva_cerrada_bloquea_las_acciones(client, datos, reserva_en):
    for estado in (
        EstadoReserva.CUMPLIDA,
        EstadoReserva.CANCELADA,
        EstadoReserva.AUSENTE,
    ):
        reserva = reserva_en(timedelta(days=2), estado=estado)
        cambios = datos()
        del cambios["sena"]
        respuestas = [
            client.put(f"{URL}/{reserva.id}", json=cambios),
            client.post(f"{URL}/{reserva.id}/cancelacion"),
            client.post(f"{URL}/{reserva.id}/llegada"),
            client.post(f"{URL}/{reserva.id}/ausencia"),
        ]
        for r in respuestas:
            assert r.status_code == 409
            assert r.json()["code"] == "RESERVA_CERRADA"


def test_hu11b_reserva_inexistente(client, salon):
    assert client.post(f"{URL}/999/llegada").status_code == 404
