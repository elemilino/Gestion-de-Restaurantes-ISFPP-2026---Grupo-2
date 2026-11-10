"""Pruebas del módulo promociones (HU-09a).

Cubre CA1 a CA5, la regla de superposición, los filtros de estado, los permisos
(solo ADMINISTRADOR) y la integración con la baja de productos de la carta.
"""

from datetime import date, timedelta

import pytest

from app.core.enums import Rol
from app.models.promociones import Promocion

URL = "/api/v1/promociones"


def fecha(dias: int = 0) -> str:
    return str(date.today() + timedelta(days=dias))


def payload(productos_ids, **cambios) -> dict:
    datos = {
        "descripcion": "Promo de prueba",
        "fecha_inicio": fecha(0),
        "fecha_fin": fecha(5),
        "descuento": "15.00",
        "productos_ids": productos_ids,
    }
    datos.update(cambios)
    return datos


# --- CA1: registrar una promoción ---


def test_hu09a_ca1_crea_promocion_activa_con_productos(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p1 = crear_producto()
    p2 = crear_producto()

    r = client.post(URL, json=payload([p1.id, p2.id]), headers=h)

    assert r.status_code == 201
    datos = r.json()
    assert datos["descripcion"] == "Promo de prueba"
    assert datos["descuento"] == "15.00"
    assert datos["activo"] is True
    assert datos["vigente"] is True
    assert {p["id"] for p in datos["productos"]} == {p1.id, p2.id}

    listado = client.get(URL, headers=h)
    assert listado.status_code == 200
    assert [p["id"] for p in listado.json()] == [datos["id"]]


def test_hu09a_ca1_deduplica_productos(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()

    r = client.post(URL, json=payload([p.id, p.id]), headers=h)

    assert r.status_code == 201
    assert [x["id"] for x in r.json()["productos"]] == [p.id]


# --- CA2: validar datos obligatorios ---


@pytest.mark.parametrize(
    "campo",
    ["descripcion", "descuento", "fecha_inicio", "fecha_fin", "productos_ids"],
)
def test_hu09a_ca2_rechaza_campos_obligatorios_faltantes(
    client, headers, crear_producto, campo
):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    datos = payload([p.id])
    datos.pop(campo)

    r = client.post(URL, json=datos, headers=h)

    assert r.status_code == 422
    assert campo in [error["loc"][-1] for error in r.json()["detail"]]


def test_hu09a_ca2_rechaza_descripcion_vacia(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()

    r = client.post(URL, json=payload([p.id], descripcion="   "), headers=h)

    assert r.status_code == 422


def test_hu09a_ca2_rechaza_descripcion_demasiado_larga(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()

    r = client.post(URL, json=payload([p.id], descripcion="x" * 201), headers=h)

    assert r.status_code == 422


@pytest.mark.parametrize("descuento", ["0", "-5", "100.01", "10.123"])
def test_hu09a_ca2_rechaza_descuento_invalido(
    client, headers, crear_producto, descuento
):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()

    r = client.post(URL, json=payload([p.id], descuento=descuento), headers=h)

    assert r.status_code == 422


def test_hu09a_ca2_rechaza_sin_productos(client, headers):
    h = headers(Rol.ADMINISTRADOR)

    r = client.post(URL, json=payload([]), headers=h)

    assert r.status_code == 422
    assert r.json()["code"] == "PROMOCION_SIN_PRODUCTOS"


def test_hu09a_ca2_rechaza_producto_inexistente(client, headers):
    h = headers(Rol.ADMINISTRADOR)

    r = client.post(URL, json=payload([9999]), headers=h)

    assert r.status_code == 422
    assert r.json()["code"] == "PRODUCTO_NO_ENCONTRADO"


def test_hu09a_ca2_rechaza_producto_inactivo(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto(activo=False)

    r = client.post(URL, json=payload([p.id]), headers=h)

    assert r.status_code == 422
    assert r.json()["code"] == "PRODUCTO_INACTIVO"
    assert p.nombre in r.json()["detail"]


# --- CA3: evitar período de vigencia inválido ---


@pytest.mark.parametrize("dias_fin", [0, -1])
def test_hu09a_ca3_rechaza_fecha_fin_igual_o_anterior(
    client, headers, crear_producto, dias_fin
):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    inicio = date.today() + timedelta(days=2)

    r = client.post(
        URL,
        json=payload(
            [p.id],
            fecha_inicio=str(inicio),
            fecha_fin=str(inicio + timedelta(days=dias_fin)),
        ),
        headers=h,
    )

    assert r.status_code == 422
    assert r.json()["code"] == "PROMOCION_FECHAS_INVALIDAS"


def test_hu09a_ca3_rechaza_fecha_inicio_pasada(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()

    r = client.post(
        URL,
        json=payload([p.id], fecha_inicio=fecha(-1), fecha_fin=fecha(5)),
        headers=h,
    )

    assert r.status_code == 422
    assert r.json()["code"] == "PROMOCION_FECHAS_INVALIDAS"


def test_hu09a_ca3_acepta_rango_valido(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()

    r = client.post(
        URL,
        json=payload([p.id], fecha_inicio=fecha(0), fecha_fin=fecha(1)),
        headers=h,
    )

    assert r.status_code == 201


# --- CA4: modificar datos y productos ---


def test_hu09a_ca4_modifica_datos(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(URL, json=payload([p.id]), headers=h).json()["id"]

    r = client.put(
        f"{URL}/{promo_id}",
        json={
            "descripcion": "Promo editada",
            "descuento": "25.5",
            "fecha_inicio": fecha(1),
            "fecha_fin": fecha(10),
        },
        headers=h,
    )

    assert r.status_code == 200
    datos = r.json()
    assert datos["descripcion"] == "Promo editada"
    assert datos["descuento"] == "25.50"
    assert datos["fecha_inicio"] == fecha(1)
    assert datos["fecha_fin"] == fecha(10)
    assert datos["vigente"] is False  # todavía no empezó
    assert [x["id"] for x in datos["productos"]] == [p.id]


def test_hu09a_ca4_reemplaza_productos(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p1 = crear_producto()
    p2 = crear_producto()
    promo_id = client.post(URL, json=payload([p1.id]), headers=h).json()["id"]

    r = client.put(f"{URL}/{promo_id}", json={"productos_ids": [p2.id]}, headers=h)

    assert r.status_code == 200
    assert [x["id"] for x in r.json()["productos"]] == [p2.id]


def test_hu09a_ca4_modificacion_parcial_conserva_el_resto(
    client, headers, crear_producto
):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(URL, json=payload([p.id]), headers=h).json()["id"]

    r = client.put(
        f"{URL}/{promo_id}", json={"descripcion": "Solo cambio esto"}, headers=h
    )

    assert r.status_code == 200
    datos = r.json()
    assert datos["descripcion"] == "Solo cambio esto"
    assert datos["descuento"] == "15.00"
    assert datos["fecha_inicio"] == fecha(0)
    assert datos["fecha_fin"] == fecha(5)
    assert [x["id"] for x in datos["productos"]] == [p.id]


def test_hu09a_ca4_rechaza_rango_invalido(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(URL, json=payload([p.id]), headers=h).json()["id"]

    r = client.put(f"{URL}/{promo_id}", json={"fecha_fin": fecha(0)}, headers=h)

    assert r.status_code == 422
    assert r.json()["code"] == "PROMOCION_FECHAS_INVALIDAS"


def test_hu09a_ca4_rechaza_fecha_inicio_pasada_si_cambia(
    client, headers, crear_producto
):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(URL, json=payload([p.id]), headers=h).json()["id"]

    r = client.put(f"{URL}/{promo_id}", json={"fecha_inicio": fecha(-1)}, headers=h)

    assert r.status_code == 422
    assert r.json()["code"] == "PROMOCION_FECHAS_INVALIDAS"


def test_hu09a_ca4_permite_conservar_fecha_inicio_pasada(
    client, headers, crear_producto, crear_promocion
):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo = crear_promocion(
        descripcion="Ya comenzó",
        fecha_inicio=date.today() - timedelta(days=10),
        fecha_fin=date.today() + timedelta(days=10),
        activo=True,
        productos=[p],
    )

    r = client.put(
        f"{URL}/{promo.id}", json={"descripcion": "Sigue vigente"}, headers=h
    )

    assert r.status_code == 200
    assert r.json()["descripcion"] == "Sigue vigente"
    assert r.json()["vigente"] is True


@pytest.mark.parametrize(
    "campo", ["descripcion", "descuento", "fecha_inicio", "fecha_fin"]
)
def test_hu09a_ca4_rechaza_campo_obligatorio_nulo(
    client, headers, crear_producto, campo
):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(URL, json=payload([p.id]), headers=h).json()["id"]

    r = client.put(f"{URL}/{promo_id}", json={campo: None}, headers=h)

    assert r.status_code == 422
    assert r.json()["code"] == "CAMPO_OBLIGATORIO"


def test_hu09a_ca4_rechaza_sin_productos(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(URL, json=payload([p.id]), headers=h).json()["id"]

    r = client.put(f"{URL}/{promo_id}", json={"productos_ids": []}, headers=h)

    assert r.status_code == 422
    assert r.json()["code"] == "PROMOCION_SIN_PRODUCTOS"


def test_hu09a_ca4_promocion_inexistente(client, headers):
    h = headers(Rol.ADMINISTRADOR)

    r = client.put(f"{URL}/9999", json={"descripcion": "Nadie"}, headers=h)

    assert r.status_code == 404
    assert r.json()["code"] == "PROMOCION_NO_ENCONTRADA"


# --- CA5: desactivación y baja lógica ---


def test_hu09a_ca5_desactiva_promocion(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(URL, json=payload([p.id]), headers=h).json()["id"]

    r = client.patch(f"{URL}/{promo_id}/activo", json={"activo": False}, headers=h)

    assert r.status_code == 200
    assert r.json()["activo"] is False
    assert r.json()["vigente"] is False

    detalle = client.get(f"{URL}/{promo_id}", headers=h)
    assert detalle.status_code == 200
    assert detalle.json()["activo"] is False


def test_hu09a_ca5_reactiva_promocion(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(URL, json=payload([p.id]), headers=h).json()["id"]
    client.patch(f"{URL}/{promo_id}/activo", json={"activo": False}, headers=h)

    r = client.patch(f"{URL}/{promo_id}/activo", json={"activo": True}, headers=h)

    assert r.status_code == 200
    assert r.json()["activo"] is True
    assert r.json()["vigente"] is True


def test_hu09a_ca5_baja_logica(client, headers, crear_producto, db):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(URL, json=payload([p.id]), headers=h).json()["id"]

    r = client.delete(f"{URL}/{promo_id}", headers=h)

    assert r.status_code == 204
    detalle = client.get(f"{URL}/{promo_id}", headers=h)
    assert detalle.status_code == 200
    assert detalle.json()["activo"] is False

    promo = db.get(Promocion, promo_id)
    assert promo is not None
    assert promo.activo is False


def test_hu09a_ca5_expira_automaticamente(
    client, headers, crear_producto, crear_promocion, db
):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo = crear_promocion(
        descripcion="Vencida",
        fecha_inicio=date.today() - timedelta(days=10),
        fecha_fin=date.today() - timedelta(days=1),
        activo=True,
        productos=[p],
    )

    r = client.get(URL, headers=h)

    assert r.status_code == 200
    datos = next(x for x in r.json() if x["id"] == promo.id)
    assert datos["activo"] is False
    assert datos["vigente"] is False

    db.refresh(promo)
    assert promo.activo is False


def test_hu09a_ca5_no_activa_promocion_vencida(
    client, headers, crear_producto, crear_promocion
):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo = crear_promocion(
        descripcion="Vencida",
        fecha_inicio=date.today() - timedelta(days=10),
        fecha_fin=date.today() - timedelta(days=1),
        activo=True,
        productos=[p],
    )

    r = client.patch(f"{URL}/{promo.id}/activo", json={"activo": True}, headers=h)

    assert r.status_code == 422
    assert r.json()["code"] == "PROMOCION_YA_VENCIDA"


def test_hu09a_ca5_promocion_inexistente(client, headers):
    h = headers(Rol.ADMINISTRADOR)

    assert (
        client.patch(
            f"{URL}/9999/activo", json={"activo": False}, headers=h
        ).status_code
        == 404
    )
    assert client.delete(f"{URL}/9999", headers=h).status_code == 404


def test_hu09a_obtener_promocion_inexistente(client, headers):
    h = headers(Rol.ADMINISTRADOR)

    r = client.get(f"{URL}/9999", headers=h)

    assert r.status_code == 404
    assert r.json()["code"] == "PROMOCION_NO_ENCONTRADA"


# --- Superposición ---


def test_hu09a_rechaza_promociones_superpuestas(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    client.post(
        URL,
        json=payload([p.id], fecha_inicio=fecha(1), fecha_fin=fecha(5)),
        headers=h,
    )

    r = client.post(
        URL,
        json=payload([p.id], fecha_inicio=fecha(3), fecha_fin=fecha(7)),
        headers=h,
    )

    assert r.status_code == 409
    assert r.json()["code"] == "PROMOCION_SUPERPUESTA"


def test_hu09a_permite_promociones_que_no_se_solapan(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    assert (
        client.post(
            URL,
            json=payload([p.id], fecha_inicio=fecha(1), fecha_fin=fecha(5)),
            headers=h,
        ).status_code
        == 201
    )

    r = client.post(
        URL,
        json=payload([p.id], fecha_inicio=fecha(6), fecha_fin=fecha(10)),
        headers=h,
    )

    assert r.status_code == 201


def test_hu09a_permite_promociones_simultaneas_en_otros_productos(
    client, headers, crear_producto
):
    h = headers(Rol.ADMINISTRADOR)
    p1 = crear_producto()
    p2 = crear_producto()
    assert (
        client.post(
            URL,
            json=payload([p1.id], fecha_inicio=fecha(1), fecha_fin=fecha(5)),
            headers=h,
        ).status_code
        == 201
    )

    r = client.post(
        URL,
        json=payload([p2.id], fecha_inicio=fecha(1), fecha_fin=fecha(5)),
        headers=h,
    )

    assert r.status_code == 201


def test_hu09a_promocion_inactiva_no_bloquea_una_nueva(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(
        URL,
        json=payload([p.id], fecha_inicio=fecha(1), fecha_fin=fecha(5)),
        headers=h,
    ).json()["id"]
    client.patch(f"{URL}/{promo_id}/activo", json={"activo": False}, headers=h)

    r = client.post(
        URL,
        json=payload([p.id], fecha_inicio=fecha(2), fecha_fin=fecha(6)),
        headers=h,
    )

    assert r.status_code == 201


def test_hu09a_modificar_no_puede_generar_superposicion(
    client, headers, crear_producto
):
    h = headers(Rol.ADMINISTRADOR)
    p1 = crear_producto()
    p2 = crear_producto()
    client.post(
        URL,
        json=payload([p1.id], fecha_inicio=fecha(1), fecha_fin=fecha(5)),
        headers=h,
    )
    promo_id = client.post(
        URL,
        json=payload([p2.id], fecha_inicio=fecha(1), fecha_fin=fecha(5)),
        headers=h,
    ).json()["id"]

    r = client.put(f"{URL}/{promo_id}", json={"productos_ids": [p1.id]}, headers=h)

    assert r.status_code == 409
    assert r.json()["code"] == "PROMOCION_SUPERPUESTA"


# --- Filtros de estado ---


def test_hu09a_lista_filtra_por_estado(
    client, headers, crear_producto, crear_promocion
):
    h = headers(Rol.ADMINISTRADOR)
    p1 = crear_producto()
    p2 = crear_producto()
    p3 = crear_producto()
    p4 = crear_producto()

    vigente = client.post(
        URL,
        json=payload([p1.id], fecha_inicio=fecha(0), fecha_fin=fecha(10)),
        headers=h,
    ).json()
    programada = client.post(
        URL,
        json=payload([p2.id], fecha_inicio=fecha(5), fecha_fin=fecha(10)),
        headers=h,
    ).json()
    inactiva = client.post(
        URL,
        json=payload([p3.id], fecha_inicio=fecha(0), fecha_fin=fecha(10)),
        headers=h,
    ).json()
    client.patch(f"{URL}/{inactiva['id']}/activo", json={"activo": False}, headers=h)
    vencida = crear_promocion(
        descripcion="Vencida",
        fecha_inicio=date.today() - timedelta(days=10),
        fecha_fin=date.today() - timedelta(days=1),
        activo=True,
        productos=[p4],
    )

    def ids(estado: str) -> set[int]:
        r = client.get(URL, params={"estado": estado}, headers=h)
        assert r.status_code == 200
        return {x["id"] for x in r.json()}

    assert ids("vigentes") == {vigente["id"]}
    assert ids("programadas") == {programada["id"]}
    assert ids("inactivas") == {inactiva["id"]}
    assert ids("vencidas") == {vencida.id}
    assert ids("todas") == {
        vigente["id"],
        programada["id"],
        inactiva["id"],
        vencida.id,
    }


# --- Permisos ---


@pytest.mark.parametrize("rol", [Rol.MOZO, Rol.CAJERO, Rol.RECEPCIONISTA])
def test_hu09a_solo_administrador_puede_gestionar(client, headers, crear_producto, rol):
    admin = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(URL, json=payload([p.id]), headers=admin).json()["id"]
    h = headers(rol)

    assert client.get(URL, headers=h).status_code == 403
    assert client.get(f"{URL}/{promo_id}", headers=h).status_code == 403
    assert client.post(URL, json=payload([p.id]), headers=h).status_code == 403
    assert (
        client.put(
            f"{URL}/{promo_id}", json={"descripcion": "Otra"}, headers=h
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"{URL}/{promo_id}/activo", json={"activo": False}, headers=h
        ).status_code
        == 403
    )
    assert client.delete(f"{URL}/{promo_id}", headers=h).status_code == 403


def test_hu09a_administrador_puede_gestionar(client, headers, crear_producto):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()

    creada = client.post(URL, json=payload([p.id]), headers=h)
    assert creada.status_code == 201
    promo_id = creada.json()["id"]

    assert client.get(URL, headers=h).status_code == 200
    assert client.get(f"{URL}/{promo_id}", headers=h).status_code == 200
    assert (
        client.put(
            f"{URL}/{promo_id}", json={"descripcion": "Editada"}, headers=h
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"{URL}/{promo_id}/activo", json={"activo": False}, headers=h
        ).status_code
        == 200
    )
    assert client.delete(f"{URL}/{promo_id}", headers=h).status_code == 204


# --- Integración con la carta ---


def test_hu09a_carta_bloquea_baja_de_producto_con_promocion_vigente(
    client, headers, crear_producto
):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    client.post(URL, json=payload([p.id]), headers=h)

    r = client.delete(f"/api/v1/carta/productos/{p.id}", headers=h)

    assert r.status_code == 409
    assert r.json()["code"] == "PRODUCTO_EN_USO"
    assert "promoción vigente" in r.json()["detail"]


def test_hu09a_carta_permite_baja_sin_promocion_vigente(
    client, headers, crear_producto
):
    h = headers(Rol.ADMINISTRADOR)
    p = crear_producto()
    promo_id = client.post(URL, json=payload([p.id]), headers=h).json()["id"]
    client.patch(f"{URL}/{promo_id}/activo", json={"activo": False}, headers=h)

    r = client.delete(f"/api/v1/carta/productos/{p.id}", headers=h)

    assert r.status_code == 204
