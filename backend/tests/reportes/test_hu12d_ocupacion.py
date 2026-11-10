"""HU-12d: reporte de ocupación de mesas por franja horaria."""

from datetime import datetime, timedelta

from app.core.enums import EstadoComanda

URL = "/api/v1/reportes/ocupacion"


def _celdas(cuerpo) -> dict:
    return {(c["dia_semana"], c["hora"]): c["porcentaje"] for c in cuerpo["celdas"]}


def test_hu12d_ca1_mapa_promedio_y_franja_maxima(client, venta, hace, periodo):
    # 4 mesas activas; la mesa 1 ocupada de 20 a 21 h hace 3 días.
    venta(hace(3, hora=21), apertura=hace(3, hora=20))
    cuerpo = client.get(URL, params=periodo(3, 3)).json()
    dia = hace(3).weekday()
    assert cuerpo["mesas_activas"] == 4
    assert len(cuerpo["celdas"]) == 7 * 24
    assert _celdas(cuerpo)[(dia, 20)] == 25.0
    assert cuerpo["ocupacion_promedio"] == 25.0
    maxima = cuerpo["franja_maxima"]
    assert (maxima["dia_semana"], maxima["hora"]) == (dia, 20)
    assert maxima["etiqueta"].endswith("20 a 21 h: 25 %")


def test_hu12d_ca2_cuenta_cada_franja_que_toca_la_comanda(client, venta, hace, periodo):
    venta(hace(3, hora=14, minuto=10), apertura=hace(3, hora=12, minuto=40))
    celdas = _celdas(client.get(URL, params=periodo(3, 3)).json())
    dia = hace(3).weekday()
    assert [celdas[(dia, h)] for h in (11, 12, 13, 14, 15)] == [0, 25, 25, 25, 0]


def test_hu12d_ca3_comanda_con_varias_mesas(client, venta, hace, periodo):
    venta(hace(3, hora=21), apertura=hace(3, hora=20), mesas=(1, 2))
    celdas = _celdas(client.get(URL, params=periodo(3, 3)).json())
    assert celdas[(hace(3).weekday(), 20)] == 50.0


def test_hu12d_ca4_comanda_abierta_cuenta_hasta_ahora(client, venta, periodo):
    ahora = datetime.now()
    apertura = ahora - timedelta(hours=2)
    venta(ahora, apertura=apertura, factura=None, estado=EstadoComanda.ABIERTA)
    celdas = _celdas(client.get(URL, params=periodo(1, 0)).json())
    assert celdas[(apertura.weekday(), apertura.hour)] > 0
    assert celdas[(ahora.weekday(), ahora.hour)] > 0


def test_hu12d_ca5_filtro_por_sector(client, venta, base, hace, periodo):
    venta(hace(3, hora=21), apertura=hace(3, hora=20), mesas=(4,))  # Terraza
    dia = hace(3).weekday()
    terraza = {**periodo(3, 3), "sector_id": base["terraza"].id}
    cuerpo = client.get(URL, params=terraza).json()
    assert cuerpo["mesas_activas"] == 1
    assert _celdas(cuerpo)[(dia, 20)] == 100.0
    salon = {**periodo(3, 3), "sector_id": base["salon"].id}
    assert client.get(URL, params=salon).json()["mensaje"] == (
        "No hay ocupación registrada en el período seleccionado"
    )


def test_hu12d_ca6_sin_datos_o_periodo_invalido(client, base, periodo):
    cuerpo = client.get(URL, params=periodo(5)).json()
    assert cuerpo["franja_maxima"] is None
    assert cuerpo["mensaje"] == "No hay ocupación registrada en el período seleccionado"
    assert client.get(URL, params=periodo(1, 5)).json()["code"] == "PERIODO_INVALIDO"


def test_hu12d_las_anuladas_ocupan_hasta_su_anulacion(client, venta, hace, periodo):
    venta(
        hace(3, hora=21),
        apertura=hace(3, hora=20),
        factura=None,
        estado=EstadoComanda.ANULADA,
    )
    celdas = _celdas(client.get(URL, params=periodo(3, 3)).json())
    assert celdas[(hace(3).weekday(), 20)] == 25.0
