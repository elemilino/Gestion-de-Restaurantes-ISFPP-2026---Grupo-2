"""HU-12a: reporte de ventas por período."""

from datetime import date, datetime, timedelta

from app.core.enums import EstadoFactura, Rol

URL = "/api/v1/reportes/ventas"


def test_hu12a_ca1_total_cantidad_ticket_y_por_dia(client, venta, base, hace, periodo):
    venta(hace(3), items=[(base["milanesa"], 2, "5000")])
    venta(hace(3, hora=22), items=[(base["cerveza"], 1, "4000")])
    venta(hace(2), items=[(base["flan"], 2, "3000")])
    r = client.get(URL, params=periodo(5))
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["total_facturado"] == "20000.00"
    assert cuerpo["cantidad_facturas"] == 3
    assert cuerpo["ticket_promedio"] == "6666.67"
    por_dia = {d["fecha"]: d["total"] for d in cuerpo["por_dia"]}
    assert len(por_dia) == 5  # un punto por día, aunque no haya ventas
    assert por_dia[hace(3).date().isoformat()] == "14000.00"
    assert por_dia[hace(2).date().isoformat()] == "6000.00"
    assert por_dia[hace(1).date().isoformat()] == "0.00"
    assert cuerpo["mensaje"] is None


def test_hu12a_ca2_adeudadas_van_aparte_como_pendiente(client, venta, hace, periodo):
    venta(hace(3))
    venta(hace(2), factura=EstadoFactura.ADEUDADA)
    cuerpo = client.get(URL, params=periodo(5)).json()
    assert cuerpo["total_facturado"] == "5000.00"
    assert cuerpo["cantidad_facturas"] == 1
    assert cuerpo["pendiente_cobro"] == "5000.00"


def test_hu12a_ca3_personalizado_incluye_los_dias_extremos(
    client, venta, hace, periodo
):
    venta(hace(5, hora=0, minuto=30))
    venta(hace(2, hora=23, minuto=30))
    venta(hace(6))  # fuera del período
    cuerpo = client.get(URL, params=periodo(5, 2)).json()
    assert cuerpo["cantidad_facturas"] == 2


def test_hu12a_ca4_periodo_invalido(client, base):
    hoy = date.today()
    invertido = {
        "periodo": "PERSONALIZADO",
        "desde": (hoy - timedelta(days=1)).isoformat(),
        "hasta": (hoy - timedelta(days=3)).isoformat(),
    }
    futuro = {
        "periodo": "PERSONALIZADO",
        "desde": hoy.isoformat(),
        "hasta": (hoy + timedelta(days=1)).isoformat(),
    }
    for params in (invertido, futuro, {"periodo": "PERSONALIZADO"}):
        r = client.get(URL, params=params)
        assert r.status_code == 422
        assert r.json()["code"] == "PERIODO_INVALIDO"
        assert r.json()["detail"] == "El período seleccionado no es válido"


def test_hu12a_ca5_sin_ventas(client, base, periodo):
    cuerpo = client.get(URL, params=periodo(5)).json()
    assert cuerpo["total_facturado"] == "0.00"
    assert cuerpo["ticket_promedio"] == "0.00"
    assert cuerpo["mensaje"] == "No hay ventas en el período seleccionado"


def test_hu12a_ca6_acceso_restringido(client, headers, base):
    for rol in (Rol.MOZO, Rol.CAJERO, Rol.RECEPCIONISTA, Rol.COCINERO):
        client.headers.update(headers(rol))
        assert client.get(URL).status_code == 403
    client.headers.update(headers(Rol.ADMINISTRADOR))
    assert client.get(URL).status_code == 200


def test_hu12a_por_defecto_es_el_mes_actual(client, venta):
    venta(datetime.now())
    cuerpo = client.get(URL).json()
    assert cuerpo["desde"] == date.today().replace(day=1).isoformat()
    assert cuerpo["hasta"] == date.today().isoformat()
    assert cuerpo["cantidad_facturas"] == 1


def test_hu12a_hoy_y_semana_actual(client, venta):
    venta(datetime.now())
    for periodo_ in ("HOY", "SEMANA"):
        cuerpo = client.get(URL, params={"periodo": periodo_}).json()
        assert cuerpo["cantidad_facturas"] == 1
    hoy = date.today()
    lunes = hoy - timedelta(days=hoy.weekday())
    assert client.get(URL, params={"periodo": "SEMANA"}).json()["desde"] == (
        lunes.isoformat()
    )
