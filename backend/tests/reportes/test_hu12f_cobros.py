"""HU-12f: reporte de cobros por medio de pago."""

from app.core.enums import EstadoFactura

URL = "/api/v1/reportes/cobros"


def _medios(client, params) -> dict:
    return {m["nombre"]: m for m in client.get(URL, params=params).json()["medios"]}


def test_hu12f_ca1_por_medio_ordenado_por_total(client, venta, base, hace, periodo):
    venta(hace(3), items=[(base["milanesa"], 2, "6000")])  # 12000 en efectivo
    venta(
        hace(2),
        items=[(base["milanesa"], 4, "5000")],
        pagos=[(base["visa"], "20000")],
    )
    cuerpo = client.get(URL, params=periodo(5)).json()
    assert [m["nombre"] for m in cuerpo["medios"]] == ["Visa", "Efectivo"]
    visa, efectivo = cuerpo["medios"]
    assert visa["cantidad_pagos"] == 1
    assert visa["tipo_acreditacion"] == "Diferida"
    assert visa["total_cobrado"] == "22000.00"
    assert visa["porcentaje"] == 64.7
    assert efectivo["total_cobrado"] == "12000.00"
    assert efectivo["porcentaje"] == 35.3
    assert cuerpo["total_cobrado"] == "34000.00"


def test_hu12f_ca2_factura_con_varios_medios(client, venta, base, hace, periodo):
    venta(
        hace(3),
        items=[(base["milanesa"], 6, "5000")],
        pagos=[(base["efectivo"], "10000"), (base["visa"], "20000")],
    )
    medios = _medios(client, periodo(5))
    assert medios["Efectivo"]["monto_abonado"] == "10000.00"
    assert medios["Visa"]["monto_abonado"] == "20000.00"


def test_hu12f_ca3_recargo_separado(client, venta, base, hace, periodo):
    venta(
        hace(3), items=[(base["milanesa"], 2, "5000")], pagos=[(base["visa"], "10000")]
    )
    visa = _medios(client, periodo(5))["Visa"]
    assert visa["monto_abonado"] == "10000.00"
    assert visa["recargo"] == "1000.00"
    assert visa["total_cobrado"] == "11000.00"


def test_hu12f_ca4_facturas_adeudadas_no_cuentan(client, venta, base, hace, periodo):
    venta(
        hace(3),
        items=[(base["milanesa"], 2, "5000")],
        factura=EstadoFactura.ADEUDADA,
        pagos=[(base["efectivo"], "4000")],  # pago parcial
    )
    assert _medios(client, periodo(5)) == {}


def test_hu12f_ca5_medio_dado_de_baja_sigue_apareciendo(
    db, client, venta, base, hace, periodo
):
    venta(hace(3), pagos=[(base["visa"], "5000")])
    base["visa"].activo = False
    db.commit()
    assert _medios(client, periodo(5))["Visa"]["dado_de_baja"] is True


def test_hu12f_ca6_sin_datos_o_periodo_invalido(client, base, periodo):
    cuerpo = client.get(URL, params=periodo(5)).json()
    assert cuerpo["mensaje"] == "No hay cobros en el período seleccionado"
    assert client.get(URL, params=periodo(1, 5)).json()["code"] == "PERIODO_INVALIDO"
