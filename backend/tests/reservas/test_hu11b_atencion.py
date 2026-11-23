"""HU-11b: atención de reservas (llegada y ausencia con 15 min de tolerancia)."""

from datetime import timedelta

from app.core.enums import EstadoReserva

URL = "/api/v1/reservas"


def test_hu11b_ca1_llegada_pasa_a_cumplida_y_abre_comanda(
    db, client, headers, reserva_en, plato
):
    from decimal import Decimal
    from app.core.enums import Rol
    from app.models.reservas import DetalleMenuAcordado, MenuAcordado

    reserva = reserva_en(timedelta(minutes=10))
    reserva.menu_acordado = MenuAcordado(
        detalles=[
            DetalleMenuAcordado(
                producto_id=plato.id, cantidad=2, precio=Decimal("4500")
            )
        ]
    )
    db.commit()

    r = client.post(f"{URL}/{reserva.id}/llegada")
    assert r.status_code == 200
    assert r.json()["estado"] == "CUMPLIDA"
    assert r.json()["fecha_hora_llegada"] is not None
    assert r.json()["tiene_comanda"] is True

    # Verifica que la mesa figure ocupada en el tablero con los platos precargados
    client.headers.update(headers(Rol.ADMINISTRADOR))
    tablero = client.get("/api/v1/comandas/tablero-mesas").json()
    mesa1 = next(m for m in tablero if m["numero"] == 1)
    assert mesa1["estado_mesa"] == "ocupada"
    assert mesa1["comanda"] is not None
    assert len(mesa1["comanda"]["detalles"]) == 1
    assert mesa1["comanda"]["detalles"][0]["producto"]["nombre"] == "Ñoquis"
    assert mesa1["comanda"]["detalles"][0]["cantidad"] == 2
    assert mesa1["comanda"]["detalles"][0]["precio_unitario"] == "4500.00"


def test_hu11b_ca2_ausencia_al_alcanzar_fecha_hora(client, reserva_en):
    reserva = reserva_en(-timedelta(minutes=1))
    r = client.post(f"{URL}/{reserva.id}/ausencia")
    assert r.status_code == 200
    assert r.json()["estado"] == "AUSENTE"
    assert r.json()["sena"]["devuelta"] is False


def test_hu11b_ca2_transicion_automatica_a_ausente_al_consultar(client, reserva_en):
    reserva = reserva_en(-timedelta(minutes=1))
    r = client.get(f"{URL}/{reserva.id}")
    assert r.status_code == 200
    assert r.json()["estado"] == "AUSENTE"


def test_hu11b_ca3_ausencia_antes_del_horario(client, reserva_en):
    reserva = reserva_en(timedelta(minutes=10))
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
