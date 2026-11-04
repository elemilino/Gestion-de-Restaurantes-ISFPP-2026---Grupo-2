"""Pruebas del módulo clientes (HU-10).

Cubre CA1 a CA5 y CA7. CA6 (baja bloqueada por reservas activas) se agrega
cuando HU-11 incorpore el modelo `Reserva`.
"""

import pytest

from app.core.enums import Rol
from app.models.clientes import Cliente

URL = "/api/v1/clientes"


def payload(**cambios) -> dict:
    datos = {
        "nombre": "Juan",
        "apellido": "Pérez",
        "telefono": "1122334455",
        "dni": "30123456",
        "email": "juan.perez@example.com",
    }
    datos.update(cambios)
    return datos


def test_hu10_ca1_crea_cliente_y_aparece_en_el_listado(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    r = client.post(URL, json=payload(), headers=h)

    assert r.status_code == 201
    datos = r.json()
    assert datos["nombre"] == "Juan"
    assert datos["apellido"] == "Pérez"
    assert datos["telefono"] == "1122334455"
    assert datos["dni"] == "30123456"
    assert datos["email"] == "juan.perez@example.com"
    assert datos["eliminado"] is False

    listado = client.get(URL, headers=h)
    assert listado.status_code == 200
    assert [c["dni"] for c in listado.json()] == ["30123456"]


def test_hu10_ca1_crea_cliente_sin_email(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    datos = payload()
    datos.pop("email")

    r = client.post(URL, json=datos, headers=h)

    assert r.status_code == 201
    assert r.json()["email"] is None


@pytest.mark.parametrize("campo", ["nombre", "apellido", "telefono", "dni"])
def test_hu10_ca2_rechaza_datos_obligatorios_faltantes(client, headers, campo):
    h = headers(Rol.RECEPCIONISTA)
    datos = payload()
    datos.pop(campo)

    r = client.post(URL, json=datos, headers=h)

    assert r.status_code == 422
    campos_faltantes = [error["loc"][-1] for error in r.json()["detail"]]
    assert campo in campos_faltantes


def test_hu10_ca2_rechaza_email_invalido(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    r = client.post(URL, json=payload(email="no-es-un-email"), headers=h)

    assert r.status_code == 422


def test_hu10_ca3_rechaza_dni_duplicado(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    client.post(URL, json=payload(), headers=h)

    r = client.post(
        URL,
        json=payload(nombre="Otro", apellido="Cliente", telefono="1199998888"),
        headers=h,
    )

    assert r.status_code == 409
    assert r.json()["code"] == "CLIENTE_DNI_DUPLICADO"
    assert "DNI" in r.json()["detail"]


def test_hu10_ca4_modifica_datos_del_cliente(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    cliente_id = client.post(URL, json=payload(), headers=h).json()["id"]

    r = client.put(
        f"{URL}/{cliente_id}",
        json={
            "nombre": "Juan Carlos",
            "telefono": "1199998888",
            "email": "juan.carlos@example.com",
        },
        headers=h,
    )

    assert r.status_code == 200
    datos = r.json()
    assert datos["nombre"] == "Juan Carlos"
    assert datos["apellido"] == "Pérez"
    assert datos["telefono"] == "1199998888"
    assert datos["email"] == "juan.carlos@example.com"
    assert datos["dni"] == "30123456"


def test_hu10_ca4_rechaza_dni_duplicado_al_modificar(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    client.post(URL, json=payload(), headers=h)
    cliente_id = client.post(
        URL,
        json=payload(
            nombre="Laura",
            apellido="Gómez",
            dni="33444555",
            telefono="1144556677",
        ),
        headers=h,
    ).json()["id"]

    r = client.put(f"{URL}/{cliente_id}", json={"dni": "30123456"}, headers=h)

    assert r.status_code == 409
    assert r.json()["code"] == "CLIENTE_DNI_DUPLICADO"


def test_hu10_ca4_rechaza_campo_obligatorio_nulo(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    cliente_id = client.post(URL, json=payload(), headers=h).json()["id"]

    r = client.put(f"{URL}/{cliente_id}", json={"nombre": None}, headers=h)

    assert r.status_code == 422
    assert r.json()["code"] == "CAMPO_OBLIGATORIO"


def test_hu10_ca4_cliente_inexistente(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    r = client.put(f"{URL}/9999", json={"nombre": "Nadie"}, headers=h)

    assert r.status_code == 404
    assert r.json()["code"] == "CLIENTE_NO_ENCONTRADO"


def test_hu10_ca5_elimina_cliente_sin_reservas(client, headers, db):
    h = headers(Rol.RECEPCIONISTA)
    cliente_id = client.post(URL, json=payload(), headers=h).json()["id"]

    r = client.delete(f"{URL}/{cliente_id}", headers=h)

    assert r.status_code == 204
    assert client.get(f"{URL}/{cliente_id}", headers=h).status_code == 404
    assert client.get(URL, headers=h).json() == []

    cliente = db.get(Cliente, cliente_id)
    assert cliente is not None
    assert cliente.activo is False
    assert cliente.eliminado is True


def test_hu10_ca5_permite_reutilizar_dni_de_cliente_eliminado(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    cliente_id = client.post(URL, json=payload(), headers=h).json()["id"]
    client.delete(f"{URL}/{cliente_id}", headers=h)

    r = client.post(URL, json=payload(nombre="Nuevo"), headers=h)

    assert r.status_code == 201


def test_hu10_ca5_cliente_inexistente(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    r = client.delete(f"{URL}/9999", headers=h)

    assert r.status_code == 404
    assert r.json()["code"] == "CLIENTE_NO_ENCONTRADO"


def test_hu10_ca7_busca_por_dni_nombre_y_apellido(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    client.post(URL, json=payload(), headers=h)
    client.post(
        URL,
        json=payload(
            nombre="Laura",
            apellido="Gómez",
            dni="33444555",
            telefono="1144556677",
        ),
        headers=h,
    )

    por_dni = client.get(URL, params={"busqueda": "3344"}, headers=h)
    assert [c["dni"] for c in por_dni.json()] == ["33444555"]

    por_nombre = client.get(URL, params={"busqueda": "laura"}, headers=h)
    assert [c["dni"] for c in por_nombre.json()] == ["33444555"]

    por_apellido = client.get(URL, params={"busqueda": "perez"}, headers=h)
    assert [c["dni"] for c in por_apellido.json()] == ["30123456"]

    por_nombre_completo = client.get(URL, params={"busqueda": "laura gomez"}, headers=h)
    assert [c["dni"] for c in por_nombre_completo.json()] == ["33444555"]


def test_hu10_ca7_obtiene_detalle_de_cliente(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    cliente_id = client.post(URL, json=payload(), headers=h).json()["id"]

    r = client.get(f"{URL}/{cliente_id}", headers=h)

    assert r.status_code == 200
    assert r.json()["id"] == cliente_id
    assert r.json()["dni"] == "30123456"


def test_hu10_mozo_no_puede_gestionar_clientes(client, headers):
    h = headers(Rol.MOZO)

    assert client.get(URL, headers=h).status_code == 403
    assert client.post(URL, json=payload(), headers=h).status_code == 403
    assert client.get(f"{URL}/1", headers=h).status_code == 403
    assert client.put(f"{URL}/1", json={"nombre": "Test"}, headers=h).status_code == 403
    assert client.delete(f"{URL}/1", headers=h).status_code == 403


def test_hu10_recepcionista_puede_gestionar_clientes(client, headers):
    h = headers(Rol.RECEPCIONISTA)
    cliente_id = client.post(URL, json=payload(), headers=h).json()["id"]

    assert client.get(URL, headers=h).status_code == 200
    assert client.get(f"{URL}/{cliente_id}", headers=h).status_code == 200
    assert (
        client.put(
            f"{URL}/{cliente_id}", json={"telefono": "1100000000"}, headers=h
        ).status_code
        == 200
    )
    assert client.delete(f"{URL}/{cliente_id}", headers=h).status_code == 204
