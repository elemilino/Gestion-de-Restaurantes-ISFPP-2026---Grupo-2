"""HU-12c: reporte de ventas y comandas por mozo."""

from app.core.enums import EstadoComanda, EstadoFactura

URL = "/api/v1/reportes/mozos"


def test_hu12c_ca1_por_mozo_ordenado_por_facturado(client, venta, base, hace, periodo):
    venta(hace(3), mozo=base["ana"], comensales=2)
    venta(
        hace(3), mozo=base["beto"], comensales=4, items=[(base["milanesa"], 3, "5000")]
    )
    venta(hace(2), mozo=base["beto"], comensales=2, factura=EstadoFactura.ADEUDADA)
    mozos = client.get(URL, params=periodo(5)).json()["mozos"]
    assert [m["nombre"] for m in mozos] == ["Beto", "Ana"]
    beto = mozos[0]
    assert beto["comandas"] == 2
    assert beto["comensales"] == 6
    # Solo suman las facturas Pagadas; el promedio es sobre las comandas cerradas.
    assert beto["total_facturado"] == "15000.00"
    assert beto["promedio_por_comanda"] == "7500.00"
    assert beto["detalle"] == []


def test_hu12c_ca2_detalle_de_un_mozo(client, venta, base, hace, periodo):
    venta(hace(3), mozo=base["ana"], mesas=(1, 2), comensales=6)
    venta(hace(3), mozo=base["beto"])
    mozos = client.get(URL, params={**periodo(5), "dni": "11111111"}).json()["mozos"]
    assert [m["nombre"] for m in mozos] == ["Ana"]
    detalle = mozos[0]["detalle"]
    assert len(detalle) == 1
    assert detalle[0]["mesas"] == [1, 2]
    assert detalle[0]["comensales"] == 6
    assert detalle[0]["importe"] == "5000.00"


def test_hu12c_ca3_mozo_dado_de_baja_sigue_apareciendo(
    db, client, venta, base, hace, periodo
):
    venta(hace(3), mozo=base["beto"])
    base["beto"].activo = False
    db.commit()
    mozo = client.get(URL, params=periodo(5)).json()["mozos"][0]
    assert mozo["dado_de_baja"] is True


def test_hu12c_ca4_dni_inexistente(client, base, periodo):
    r = client.get(URL, params={**periodo(5), "dni": "99999999"})
    assert r.status_code == 422
    assert r.json()["code"] == "MOZO_INEXISTENTE"


def test_hu12c_ca5_comandas_abiertas_no_cuentan(client, venta, hace, periodo):
    venta(hace(3), factura=None, estado=EstadoComanda.ABIERTA)
    assert client.get(URL, params=periodo(5)).json()["mozos"] == []


def test_hu12c_ca6_sin_datos_o_periodo_invalido(client, base, periodo):
    cuerpo = client.get(URL, params=periodo(5)).json()
    assert cuerpo["mensaje"] == "No hay comandas en el período seleccionado"
    assert client.get(URL, params=periodo(1, 5)).json()["code"] == "PERIODO_INVALIDO"


def test_hu12c_ca7_comandas_anuladas_no_cuentan(client, venta, hace, periodo):
    venta(hace(3), factura=None, estado=EstadoComanda.ANULADA)
    assert client.get(URL, params=periodo(5)).json()["mozos"] == []
