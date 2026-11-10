from datetime import datetime

import pytest

from app.core.enums import EstadoComanda, EstadoReserva, Rol

URL = "/api/v1/salon/mesas"


@pytest.fixture
def salon(crear_sector):
    return crear_sector("Salón Principal")


def datos(sector, numero=1, capacidad=4):
    return {"numero": numero, "capacidad": capacidad, "sector_id": sector.id}


# --- Creación ---


def test_hu01b_ca1_crea_mesa_activa_y_aparece_en_el_listado_del_sector(
    client, headers, salon, crear_sector
):
    crear_sector("Terraza")
    h = headers()
    r = client.post(URL, json=datos(salon, numero=5, capacidad=6), headers=h)
    assert r.status_code == 201
    assert r.json() == {
        "id": r.json()["id"],
        "numero": 5,
        "capacidad": 6,
        "sector_id": salon.id,
        "sector_nombre": "Salón Principal",
        "disponibilidad": "LIBRE",
    }
    listado = client.get(URL, params={"sector_id": salon.id}, headers=h).json()
    assert [m["numero"] for m in listado] == [5]


def test_hu01b_ca1_rechaza_sector_dado_de_baja(client, headers, crear_sector):
    viejo = crear_sector("Viejo", activo=False)
    r = client.post(URL, json=datos(viejo), headers=headers())
    assert r.status_code == 422
    assert r.json()["code"] == "SECTOR_INVALIDO"


def test_hu01b_ca2_rechaza_numero_duplicado_en_todo_el_salon(
    client, headers, salon, crear_sector, crear_mesa
):
    terraza = crear_sector("Terraza")
    crear_mesa(7, terraza)
    r = client.post(URL, json=datos(salon, numero=7), headers=headers())
    assert r.status_code == 409
    assert r.json()["code"] == "MESA_DUPLICADA"
    assert r.json()["detail"] == "Ya existe una mesa activa con el número 7"


def test_hu01b_ca2_permite_repetir_el_numero_de_una_mesa_dada_de_baja(
    client, headers, salon, crear_mesa
):
    crear_mesa(7, salon, activo=False)
    assert (
        client.post(URL, json=datos(salon, numero=7), headers=headers()).status_code
        == 201
    )


def test_hu01b_ca2_rechaza_numero_duplicado_al_modificar(
    client, headers, salon, crear_mesa
):
    crear_mesa(1, salon)
    mesa = crear_mesa(2, salon)
    r = client.put(f"{URL}/{mesa.id}", json=datos(salon, numero=1), headers=headers())
    assert r.status_code == 409
    assert r.json()["code"] == "MESA_DUPLICADA"


@pytest.mark.parametrize("capacidad", [0, -2])
def test_hu01b_ca3_rechaza_capacidad_no_positiva_al_crear(
    client, headers, salon, capacidad
):
    r = client.post(URL, json=datos(salon, capacidad=capacidad), headers=headers())
    assert r.status_code == 422
    assert r.json()["code"] == "CAPACIDAD_INVALIDA"
    assert r.json()["detail"] == "La capacidad debe ser mayor a 0"


def test_hu01b_ca3_rechaza_capacidad_no_positiva_al_modificar(
    client, headers, salon, crear_mesa
):
    mesa = crear_mesa(1, salon)
    r = client.put(
        f"{URL}/{mesa.id}", json=datos(salon, capacidad=0), headers=headers()
    )
    assert r.status_code == 422
    assert r.json()["code"] == "CAPACIDAD_INVALIDA"


# --- Modificación ---


def test_hu01b_ca4_modifica_numero_capacidad_y_sector(
    client, headers, salon, crear_sector, crear_mesa
):
    terraza = crear_sector("Terraza")
    mesa = crear_mesa(1, salon)
    r = client.put(
        f"{URL}/{mesa.id}",
        json=datos(terraza, numero=10, capacidad=8),
        headers=headers(),
    )
    assert r.status_code == 200
    assert (r.json()["numero"], r.json()["capacidad"], r.json()["sector_nombre"]) == (
        10,
        8,
        "Terraza",
    )


def test_hu01b_ca4_bloquea_modificar_mesa_con_comanda_abierta(
    client, headers, salon, crear_mesa, crear_comanda
):
    mesa = crear_mesa(1, salon)
    comanda = crear_comanda(mesa)
    r = client.put(
        f"{URL}/{mesa.id}", json=datos(salon, capacidad=6), headers=headers()
    )
    assert r.status_code == 409
    assert r.json()["code"] == "MESA_CON_COMANDA"
    assert f"comanda #{comanda.id}" in r.json()["detail"]


def test_hu01b_ca5_bloquea_reducir_capacidad_por_debajo_de_una_reserva_activa(
    client, headers, salon, crear_mesa, crear_reserva
):
    mesa = crear_mesa(1, salon, capacidad=6)
    reserva = crear_reserva([mesa], comensales=5)
    r = client.put(
        f"{URL}/{mesa.id}", json=datos(salon, capacidad=4), headers=headers()
    )
    assert r.status_code == 409
    assert r.json()["code"] == "MESA_CON_RESERVA"
    assert f"reserva #{reserva.id}" in r.json()["detail"]
    assert "es para 5 comensales" in r.json()["detail"]


def test_hu01b_ca5_permite_reducir_hasta_los_comensales_de_la_reserva(
    client, headers, salon, crear_mesa, crear_reserva
):
    mesa = crear_mesa(1, salon, capacidad=6)
    crear_reserva([mesa], comensales=5)
    r = client.put(
        f"{URL}/{mesa.id}", json=datos(salon, capacidad=5), headers=headers()
    )
    assert r.status_code == 200


def test_hu01b_ca5_no_bloquea_por_reservas_que_no_estan_activas(
    client, headers, salon, crear_mesa, crear_reserva
):
    mesa = crear_mesa(1, salon, capacidad=6)
    crear_reserva([mesa], comensales=6, estado=EstadoReserva.CANCELADA)
    r = client.put(
        f"{URL}/{mesa.id}", json=datos(salon, capacidad=2), headers=headers()
    )
    assert r.status_code == 200


def test_hu01b_ca5_con_reserva_de_varias_mesas_suma_sus_capacidades(
    client, headers, salon, crear_mesa, crear_reserva
):
    mesa1 = crear_mesa(1, salon, capacidad=6)
    mesa2 = crear_mesa(2, salon, capacidad=6)
    crear_reserva([mesa1, mesa2], comensales=10)
    h = headers()
    # 4 + 6 = 10: alcanza
    assert (
        client.put(f"{URL}/{mesa1.id}", json=datos(salon, 1, 4), headers=h).status_code
        == 200
    )
    # 3 + 6 = 9: no alcanza
    r = client.put(f"{URL}/{mesa1.id}", json=datos(salon, 1, 3), headers=h)
    assert r.status_code == 409
    assert r.json()["code"] == "MESA_CON_RESERVA"


# --- Eliminación ---


def test_hu01b_ca6_elimina_mesa_sin_reservas_ni_comanda_abierta(
    client, headers, salon, crear_mesa, crear_comanda, crear_reserva
):
    mesa = crear_mesa(1, salon)
    crear_comanda(mesa, estado=EstadoComanda.FACTURADA)
    crear_reserva([mesa], comensales=2, estado=EstadoReserva.CUMPLIDA)
    h = headers()
    assert client.delete(f"{URL}/{mesa.id}", headers=h).status_code == 204
    assert client.get(URL, headers=h).json() == []


def test_hu01b_ca7_bloquea_eliminar_mesa_con_comanda_abierta(
    client, headers, salon, crear_mesa, crear_comanda
):
    mesa = crear_mesa(1, salon)
    comanda = crear_comanda(mesa)
    r = client.delete(f"{URL}/{mesa.id}", headers=headers())
    assert r.status_code == 409
    assert r.json()["code"] == "MESA_EN_USO"
    assert f"tiene la comanda #{comanda.id} abierta" in r.json()["detail"]


def test_hu01b_ca7_bloquea_eliminar_mesa_con_reserva_activa(
    client, headers, salon, crear_mesa, crear_reserva
):
    mesa = crear_mesa(1, salon)
    reserva = crear_reserva(
        [mesa], comensales=2, fecha_hora=datetime(2026, 12, 24, 21, 30)
    )
    r = client.delete(f"{URL}/{mesa.id}", headers=headers())
    assert r.status_code == 409
    assert r.json()["code"] == "MESA_EN_USO"
    assert (
        f"tiene la reserva #{reserva.id} del 24/12/2026 21:30 activa"
        in r.json()["detail"]
    )


# --- Listado ---


def test_hu01b_ca8_lista_mesas_activas_ordenadas_con_su_disponibilidad(
    client, headers, salon, crear_sector, crear_mesa, crear_comanda, crear_reserva
):
    terraza = crear_sector("Terraza")
    libre = crear_mesa(3, terraza, capacidad=2)
    ocupada = crear_mesa(1, salon)
    reservada = crear_mesa(2, salon, capacidad=6)
    crear_mesa(4, salon, activo=False)
    crear_comanda(ocupada)
    hoy = datetime.now().replace(hour=23, minute=0, second=0, microsecond=0)
    crear_reserva([reservada], comensales=4, fecha_hora=hoy)
    crear_reserva([libre], comensales=2)  # mañana: hoy sigue libre

    r = client.get(URL, headers=headers())
    assert r.status_code == 200
    assert [
        (m["numero"], m["capacidad"], m["sector_nombre"], m["disponibilidad"])
        for m in r.json()
    ] == [
        (1, 4, "Salón Principal", "OCUPADA"),
        (2, 6, "Salón Principal", "RESERVADA"),
        (3, 2, "Terraza", "LIBRE"),
    ]


def test_hu01b_ca8_filtra_por_sector(client, headers, salon, crear_sector, crear_mesa):
    terraza = crear_sector("Terraza")
    crear_mesa(1, salon)
    crear_mesa(2, terraza)
    r = client.get(URL, params={"sector_id": terraza.id}, headers=headers())
    assert [m["numero"] for m in r.json()] == [2]


def test_hu01b_ca8_listado_vacio(client, headers):
    r = client.get(URL, headers=headers())
    assert r.status_code == 200
    assert r.json() == []


def test_hu01b_modificar_o_eliminar_mesa_inexistente_da_404(client, headers, salon):
    h = headers()
    assert client.put(f"{URL}/99", json=datos(salon), headers=h).status_code == 404
    assert client.delete(f"{URL}/99", headers=h).status_code == 404


def test_hu01b_mozo_no_puede_gestionar_mesas(client, headers, salon):
    h = headers(Rol.MOZO)
    assert client.get(URL, headers=h).status_code == 403
    assert client.post(URL, json=datos(salon), headers=h).status_code == 403
