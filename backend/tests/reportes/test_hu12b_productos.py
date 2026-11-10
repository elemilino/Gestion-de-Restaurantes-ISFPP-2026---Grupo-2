"""HU-12b: reporte de productos más vendidos."""

from app.core.enums import EstadoComanda, EstadoFactura

URL = "/api/v1/reportes/productos-mas-vendidos"


def _ranking(client, params):
    return [
        (p["nombre"], p["unidades"], p["importe"])
        for p in client.get(URL, params=params).json()["productos"]
    ]


def test_hu12b_ca1_ranking_por_unidades_con_desempate(
    client, venta, base, hace, periodo
):
    venta(hace(3), items=[(base["milanesa"], 3, "5000"), (base["cerveza"], 3, "4000")])
    venta(hace(2), items=[(base["flan"], 5, "3000")])
    r = client.get(URL, params=periodo(5))
    productos = r.json()["productos"]
    assert [p["posicion"] for p in productos] == [1, 2, 3]
    # Flan tiene más unidades; Milanesa y Cerveza empatan y desempata el importe.
    assert _ranking(client, periodo(5)) == [
        ("Flan", 5, "15000.00"),
        ("Milanesa", 3, "15000.00"),
        ("Cerveza", 3, "12000.00"),
    ]
    assert productos[0]["seccion"] == "Minutas"
    assert productos[0]["tipo"] == "POSTRE"


def test_hu12b_ca2_filtros_por_tipo_y_seccion(client, venta, base, hace, periodo):
    venta(hace(3), items=[(base["milanesa"], 1, "5000"), (base["cerveza"], 2, "4000")])
    assert _ranking(client, {**periodo(5), "tipo": "BEBIDA"}) == [
        ("Cerveza", 2, "8000.00")
    ]
    seccion = {**periodo(5), "seccion_id": base["minutas"].id}
    assert _ranking(client, seccion) == [("Milanesa", 1, "5000.00")]


def test_hu12b_ca3_usa_el_precio_historico(client, venta, base, hace, periodo):
    venta(hace(4), items=[(base["milanesa"], 1, "5000")])
    venta(hace(2), items=[(base["milanesa"], 1, "5500")])
    assert _ranking(client, periodo(5)) == [("Milanesa", 2, "10500.00")]


def test_hu12b_ca4_producto_dado_de_baja_sigue_apareciendo(
    db, client, venta, base, hace, periodo
):
    venta(hace(3))
    base["milanesa"].activo = False
    db.commit()
    producto = client.get(URL, params=periodo(5)).json()["productos"][0]
    assert producto["nombre"] == "Milanesa"
    assert producto["eliminado"] is True


def test_hu12b_ca5_comandas_sin_facturar_no_cuentan(client, venta, base, hace, periodo):
    venta(hace(3), factura=None)  # cerrada sin factura
    venta(hace(3), factura=EstadoFactura.ADEUDADA)
    venta(hace(3), factura=None, estado=EstadoComanda.ABIERTA)
    venta(hace(3), factura=None, estado=EstadoComanda.ANULADA)
    assert _ranking(client, periodo(5)) == []


def test_hu12b_ca6_sin_ventas_o_periodo_invalido(client, base, periodo):
    cuerpo = client.get(URL, params=periodo(5)).json()
    assert cuerpo["mensaje"] == "No hay ventas en el período seleccionado"
    r = client.get(URL, params=periodo(1, 5))
    assert r.status_code == 422
    assert r.json()["code"] == "PERIODO_INVALIDO"
