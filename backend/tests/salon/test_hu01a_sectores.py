from app.core.enums import Rol

URL = "/api/v1/salon/sectores"


def test_hu01a_ca1_crea_sector_y_aparece_en_el_listado(client, headers):
    h = headers(Rol.ADMINISTRADOR)
    r = client.post(
        URL, json={"nombre": "Terraza", "descripcion": "Al aire libre"}, headers=h
    )
    assert r.status_code == 201
    assert r.json()["nombre"] == "Terraza"
    assert r.json()["descripcion"] == "Al aire libre"
    assert [s["nombre"] for s in client.get(URL, headers=h).json()] == ["Terraza"]


def test_hu01a_ca1_descripcion_es_opcional(client, headers):
    r = client.post(URL, json={"nombre": "Patio"}, headers=headers())
    assert r.status_code == 201
    assert r.json()["descripcion"] is None


def test_hu01a_ca1_rechaza_nombre_vacio(client, headers):
    r = client.post(URL, json={"nombre": "   "}, headers=headers())
    assert r.status_code == 422


def test_hu01a_ca2_rechaza_nombre_duplicado_sin_distinguir_mayusculas(
    client, headers, crear_sector
):
    crear_sector("Terraza")
    r = client.post(URL, json={"nombre": "terraza"}, headers=headers())
    assert r.status_code == 409
    assert r.json()["code"] == "SECTOR_DUPLICADO"
    assert r.json()["detail"] == "Ya existe un sector con ese nombre"


def test_hu01a_ca2_permite_repetir_el_nombre_de_un_sector_dado_de_baja(
    client, headers, crear_sector
):
    crear_sector("Terraza", activo=False)
    r = client.post(URL, json={"nombre": "Terraza"}, headers=headers())
    assert r.status_code == 201


def test_hu01a_ca3_modifica_nombre_y_descripcion(client, headers, crear_sector):
    sector = crear_sector("Terraza")
    r = client.put(
        f"{URL}/{sector.id}",
        json={"nombre": "Terraza cubierta", "descripcion": "Con techo"},
        headers=headers(),
    )
    assert r.status_code == 200
    assert r.json()["nombre"] == "Terraza cubierta"
    assert r.json()["descripcion"] == "Con techo"


def test_hu01a_ca3_puede_guardar_con_su_mismo_nombre(client, headers, crear_sector):
    sector = crear_sector("Terraza")
    r = client.put(
        f"{URL}/{sector.id}",
        json={"nombre": "TERRAZA", "descripcion": None},
        headers=headers(),
    )
    assert r.status_code == 200


def test_hu01a_ca3_revalida_duplicado_al_modificar(client, headers, crear_sector):
    crear_sector("Terraza")
    patio = crear_sector("Patio")
    r = client.put(f"{URL}/{patio.id}", json={"nombre": "Terraza"}, headers=headers())
    assert r.status_code == 409
    assert r.json()["code"] == "SECTOR_DUPLICADO"


def test_hu01a_ca4_elimina_sector_sin_mesas_activas(
    client, headers, crear_sector, crear_mesa
):
    sector = crear_sector("Terraza")
    crear_mesa(1, sector, activo=False)
    h = headers()
    assert client.delete(f"{URL}/{sector.id}", headers=h).status_code == 204
    assert client.get(URL, headers=h).json() == []


def test_hu01a_ca5_bloquea_eliminar_sector_con_mesas_activas(
    client, headers, crear_sector, crear_mesa
):
    sector = crear_sector("Terraza")
    crear_mesa(1, sector)
    crear_mesa(2, sector)
    h = headers()
    r = client.delete(f"{URL}/{sector.id}", headers=h)
    assert r.status_code == 409
    assert r.json()["code"] == "SECTOR_CON_MESAS"
    assert "tiene 2 mesas activas" in r.json()["detail"]
    assert "reubicá o eliminá sus mesas" in r.json()["detail"]
    assert len(client.get(URL, headers=h).json()) == 1


def test_hu01a_ca6_lista_nombre_descripcion_y_cantidad_de_mesas_activas(
    client, headers, crear_sector, crear_mesa
):
    terraza = crear_sector("Terraza", descripcion="Al aire libre")
    crear_sector("Patio")
    crear_sector("Viejo", activo=False)
    crear_mesa(1, terraza)
    crear_mesa(2, terraza)
    crear_mesa(3, terraza, activo=False)
    r = client.get(URL, headers=headers())
    assert r.status_code == 200
    assert [(s["nombre"], s["descripcion"], s["cantidad_mesas"]) for s in r.json()] == [
        ("Patio", None, 0),
        ("Terraza", "Al aire libre", 2),
    ]


def test_hu01a_modificar_o_eliminar_sector_inexistente_da_404(client, headers):
    h = headers()
    assert client.put(f"{URL}/99", json={"nombre": "X"}, headers=h).status_code == 404
    assert client.delete(f"{URL}/99", headers=h).status_code == 404


def test_hu01a_mozo_no_puede_gestionar_sectores(client, headers):
    h = headers(Rol.MOZO)
    assert client.get(URL, headers=h).status_code == 403
    assert client.post(URL, json={"nombre": "Patio"}, headers=h).status_code == 403
