"""HU-11a: registro de reservas (crear, modificar, cancelar y listar)."""

from datetime import date, timedelta

from app.core.enums import Rol

URL = "/api/v1/reservas"


def manana() -> date:
    return date.today() + timedelta(days=1)


def test_hu11a_ca1_crea_reserva_activa_con_sena(client, datos):
    r = client.post(URL, json=datos())
    assert r.status_code == 201
    cuerpo = r.json()
    assert cuerpo["estado"] == "ACTIVA"
    assert cuerpo["nro_reserva"] == cuerpo["id"]
    assert cuerpo["hora"] == "21:00:00"
    assert [m["numero"] for m in cuerpo["mesas"]] == [1]
    assert cuerpo["sena"]["monto"] == "10000.00"
    assert cuerpo["sena"]["medio_pago_nombre"] == "Efectivo"
    assert cuerpo["sena"]["devuelta"] is False
    assert cuerpo["cliente"]["dni"] == "30111222"


def test_hu11a_ca1_bloquea_las_mesas_durante_la_duracion(client, datos):
    assert client.post(URL, json=datos(hora="20:00")).status_code == 201
    # Duración fija de 1 hora: 20:00 ya está ocupada; 21:00 está libre.
    assert client.post(URL, json=datos(hora="20:00")).status_code == 409
    assert client.post(URL, json=datos(hora="21:00")).status_code == 201


def test_hu11a_hora_en_punto_y_rango_operativo(client, datos):
    # No permite minutos distintos de 00 ni fuera de 10:00 a 23:00
    r_minutos = client.post(URL, json=datos(hora="21:30"))
    assert r_minutos.status_code == 422
    assert r_minutos.json()["code"] == "HORA_INVALIDA"

    r_temprano = client.post(URL, json=datos(hora="09:00"))
    assert r_temprano.status_code == 422
    assert r_temprano.json()["code"] == "HORA_INVALIDA"


def test_hu11a_ca2_mesa_ya_reservada_en_ese_horario(client, datos):
    client.post(URL, json=datos())
    r = client.post(URL, json=datos(numeros_mesa=[3, 1], cantidad_comensales=2))
    assert r.status_code == 409
    assert r.json()["code"] == "MESA_NO_DISPONIBLE"
    assert "mesa 1" in r.json()["detail"]


def test_hu11a_ca3_capacidad_insuficiente(client, datos):
    r = client.post(URL, json=datos(numeros_mesa=[1, 2], cantidad_comensales=8))
    assert r.status_code == 422
    assert r.json()["code"] == "CAPACIDAD_INSUFICIENTE"
    assert "faltan 2" in r.json()["detail"]


def test_hu11a_ca4_fecha_pasada(client, datos):
    ayer = (date.today() - timedelta(days=1)).isoformat()
    r = client.post(URL, json=datos(fecha=ayer))
    assert r.status_code == 422
    assert r.json()["code"] == "FECHA_INVALIDA"


def test_hu11a_ca5_cliente_inexistente_o_dado_de_baja(db, client, datos, cliente):
    assert client.post(URL, json=datos(cliente_id=999)).json()["code"] == (
        "CLIENTE_INEXISTENTE"
    )
    cliente.activo = False
    db.commit()
    r = client.post(URL, json=datos())
    assert r.status_code == 422
    assert r.json()["code"] == "CLIENTE_INEXISTENTE"


def test_hu11a_ca6_sena_obligatoria(client, datos):
    r = client.post(URL, json=datos(sena=None))
    assert r.status_code == 422
    assert r.json()["code"] == "SENA_OBLIGATORIA"


def test_hu11a_ca6_sena_con_monto_no_positivo(client, datos, medio_pago):
    r = client.post(
        URL, json=datos(sena={"monto": "0", "medio_pago_id": medio_pago.id})
    )
    assert r.status_code == 422
    assert r.json()["code"] == "SENA_INVALIDA"


def test_hu11a_ca6_sena_con_medio_de_pago_inactivo(db, client, datos, medio_pago):
    medio_pago.activo = False
    db.commit()
    r = client.post(URL, json=datos())
    assert r.status_code == 422
    assert r.json()["code"] == "SENA_INVALIDA"


def test_hu11a_ca6_sena_fuera_del_rango_permitido(client, datos, medio_pago):
    for monto in ("999", "10001"):
        r = client.post(
            URL,
            json=datos(sena={"monto": monto, "medio_pago_id": medio_pago.id}),
        )
        assert r.status_code == 422
        assert r.json()["code"] == "SENA_INVALIDA"


def test_hu11a_ca7_rechaza_plato_no_disponible(db, client, datos, plato):
    plato.disponible = False
    db.commit()
    menu = [{"producto_id": plato.id, "cantidad": 2, "precio_acordado": "4500"}]
    r = client.post(URL, json=datos(menu_acordado=menu))
    assert r.status_code == 422
    assert r.json()["code"] == "MENU_ACORDADO_INVALIDO"


def test_hu11a_ca7_guarda_el_menu_acordado(client, datos, plato):
    menu = [{"producto_id": plato.id, "cantidad": 4, "precio_acordado": "4500"}]
    r = client.post(URL, json=datos(menu_acordado=menu))
    assert r.status_code == 201
    assert r.json()["menu_acordado"] == [
        {
            "producto_id": plato.id,
            "producto_nombre": "Ñoquis",
            "cantidad": 4,
            "precio": "4500.00",
        }
    ]


def test_hu11a_ca8_menu_con_plato_eliminado(db, client, datos, plato):
    plato.activo = False
    db.commit()
    menu = [{"producto_id": plato.id, "cantidad": 2, "precio_acordado": "4500"}]
    r = client.post(URL, json=datos(menu_acordado=menu))
    assert r.status_code == 422
    assert r.json()["code"] == "MENU_ACORDADO_INVALIDO"


def test_hu11a_ca8_menu_con_cantidad_no_positiva(client, datos, plato):
    menu = [{"producto_id": plato.id, "cantidad": 0, "precio_acordado": "4500"}]
    r = client.post(URL, json=datos(menu_acordado=menu))
    assert r.status_code == 422
    assert r.json()["code"] == "MENU_ACORDADO_INVALIDO"


def test_hu11a_ca9_modifica_y_vuelve_a_validar(client, datos):
    reserva = client.post(URL, json=datos()).json()
    cambios = datos(hora="22:00", numeros_mesa=[3], cantidad_comensales=5)
    del cambios["sena"]
    r = client.put(f"{URL}/{reserva['id']}", json=cambios)
    assert r.status_code == 200
    assert r.json()["hora"] == "22:00:00"
    assert [m["numero"] for m in r.json()["mesas"]] == [3]
    # Vuelve a validar la capacidad (CA3).
    cambios["cantidad_comensales"] = 7
    assert client.put(f"{URL}/{reserva['id']}", json=cambios).json()["code"] == (
        "CAPACIDAD_INSUFICIENTE"
    )


def test_hu11a_ca9_no_choca_consigo_misma(client, datos):
    reserva = client.post(URL, json=datos()).json()
    cambios = datos(hora="21:00")
    del cambios["sena"]
    assert client.put(f"{URL}/{reserva['id']}", json=cambios).status_code == 200


def test_hu11a_ca10_cancelacion_anticipada_devuelve_la_sena(client, datos):
    reserva = client.post(URL, json=datos()).json()
    r = client.post(f"{URL}/{reserva['id']}/cancelacion")
    assert r.status_code == 200
    assert r.json()["estado"] == "CANCELADA"
    assert r.json()["sena"]["devuelta"] is True
    # Las mesas quedan disponibles.
    assert client.post(URL, json=datos()).status_code == 201


def test_hu11a_ca10_no_se_cancela_si_ya_llego_el_horario(client, reserva_en):
    reserva = reserva_en(-timedelta(minutes=5))
    r = client.post(f"{URL}/{reserva.id}/cancelacion")
    assert r.status_code == 422
    assert r.json()["code"] == "RESERVA_VENCIDA"


def test_hu11a_ca11_lista_ordenada_y_filtra(client, datos):
    client.post(URL, json=datos(hora="22:00", numeros_mesa=[3]))
    client.post(URL, json=datos(hora="20:00"))
    pasado_manana = (manana() + timedelta(days=1)).isoformat()
    client.post(URL, json=datos(fecha=pasado_manana))

    todas = client.get(URL).json()
    assert [r["hora"] for r in todas] == ["20:00:00", "22:00:00", "21:00:00"]

    del_dia = client.get(URL, params={"fecha": manana().isoformat()}).json()
    assert len(del_dia) == 2
    assert client.get(URL, params={"estado": "CANCELADA"}).json() == []


def test_hu11a_ca11_listado_vacio(client, salon):
    assert client.get(URL).json() == []


def test_hu11a_permisos(client, headers, datos):
    client.headers.update(headers(Rol.MOZO))
    assert client.get(URL).status_code == 200  # el mozo ve las reservas
    assert client.post(URL, json=datos()).status_code == 403
