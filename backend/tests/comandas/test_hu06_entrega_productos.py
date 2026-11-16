"""Pruebas de HU-06: Entrega de Productos en Mesa.

Cubre:
- CA1: Carga de plato, postre o bebida mantiene la comanda en estado ABIERTA.
- CA2: Quitar producto, modificar cantidad y registrar entrega en mesa (entregado=True)
       habilitando el cierre de la comanda para facturación.
- CA3: Cancelación/anulación por falta de pedido indicando el motivo obligatorio,
       pasando la comanda al estado ANULADA y liberando la mesa.
- Tablero operativo de mesas (/api/v1/comandas/tablero-mesas).
"""

from decimal import Decimal

import pytest

from app.core.enums import EstadoComanda, Rol, TipoProducto
from app.models.carta import Producto, SeccionCarta
from app.models.personal import Mozo
from app.models.salon import Mesa, Sector

URL = "/api/v1/comandas"
DNI_MOZO = "12345678"


@pytest.fixture(autouse=True)
def sesion_mozo(client, headers):
    """Por defecto las pruebas de HU-06 operan con sesión de Mozo."""
    client.headers.update(headers(Rol.MOZO))


@pytest.fixture
def escenario(db):
    """Crea sector, mesa, mozo y productos (plato, postre, bebida)."""
    sector = Sector(nombre="Salón Principal", activo=True)
    db.add(sector)
    db.flush()

    mesa = Mesa(numero=1, capacidad=4, sector_id=sector.id, activo=True)
    mozo = Mozo(
        dni=DNI_MOZO,
        nombre="Carlos",
        apellido="Méndez",
        sector_id=sector.id,
        activo=True,
    )
    seccion = SeccionCarta(nombre="Carta General", orden=1, activo=True)
    db.add_all([mesa, mozo, seccion])
    db.flush()

    plato = Producto(
        nombre="Milanesa napolitana",
        precio=Decimal("8500.00"),
        tipo=TipoProducto.PLATO,
        seccion_id=seccion.id,
        activo=True,
    )
    postre = Producto(
        nombre="Flan casero",
        precio=Decimal("3000.00"),
        tipo=TipoProducto.POSTRE,
        seccion_id=seccion.id,
        activo=True,
    )
    bebida = Producto(
        nombre="Agua mineral",
        precio=Decimal("1500.00"),
        tipo=TipoProducto.BEBIDA,
        seccion_id=seccion.id,
        volumen_ml=500,
        alcoholica=False,
        activo=True,
    )
    db.add_all([plato, postre, bebida])
    db.commit()

    return {
        "sector": sector,
        "mesa": mesa,
        "mozo": mozo,
        "plato": plato,
        "postre": postre,
        "bebida": bebida,
    }


def _abrir_comanda(client, comensales: int = 2, mesas: list[int] | None = None) -> int:
    r = client.post(
        URL,
        json={
            "dni_mozo": DNI_MOZO,
            "cantidad_comensales": comensales,
            "numeros_mesa": mesas or [1],
        },
    )
    assert r.status_code == 201
    return r.json()["id"]


# ---------------------------------------------------------------------------
# CA1: Carga de Producto y estado "Abierta"
# ---------------------------------------------------------------------------


def test_hu06_ca1_cargar_plato_postre_y_bebida_mantiene_estado_abierta(
    client, escenario
):
    comanda_id = _abrir_comanda(client)

    for prod, cant in [
        (escenario["plato"], 2),
        (escenario["postre"], 1),
        (escenario["bebida"], 2),
    ]:
        r = client.post(
            f"{URL}/{comanda_id}/detalles",
            json={"producto_id": prod.id, "cantidad": cant},
        )
        assert r.status_code == 200
        cuerpo = r.json()
        assert cuerpo["estado"] == EstadoComanda.ABIERTA
        assert cuerpo["abierta"] is True

    r_get = client.get(f"{URL}/{comanda_id}")
    assert r_get.status_code == 200
    detalles = r_get.json()["detalles"]
    assert len(detalles) == 3
    assert all(d["entregado"] is False for d in detalles)


# ---------------------------------------------------------------------------
# CA2: Quitar producto, modificar y registrar entrega en mesa
# ---------------------------------------------------------------------------


def test_hu06_ca2_quitar_producto_actualiza_detalle_comanda(client, escenario):
    comanda_id = _abrir_comanda(client)
    r_alta = client.post(
        f"{URL}/{comanda_id}/detalles",
        json={"producto_id": escenario["plato"].id, "cantidad": 1},
    )
    detalle_id = r_alta.json()["detalles"][0]["id"]

    r_quita = client.delete(f"{URL}/{comanda_id}/detalles/{detalle_id}")
    assert r_quita.status_code == 200
    assert r_quita.json()["detalles"] == []
    assert r_quita.json()["estado"] == EstadoComanda.ABIERTA


def test_hu06_ca2_entregar_productos_en_mesa_habilita_cierre_para_facturacion(
    client, escenario
):
    comanda_id = _abrir_comanda(client)
    client.post(
        f"{URL}/{comanda_id}/detalles",
        json={"producto_id": escenario["plato"].id, "cantidad": 2},
    )
    r_bebida = client.post(
        f"{URL}/{comanda_id}/detalles",
        json={"producto_id": escenario["bebida"].id, "cantidad": 2},
    )
    detalles = r_bebida.json()["detalles"]

    # Sin entregar no permite cerrar para facturación
    r_cierre_bloqueado = client.post(f"{URL}/{comanda_id}/cierre")
    assert r_cierre_bloqueado.status_code == 409
    assert r_cierre_bloqueado.json()["code"] == "PRODUCTOS_PENDIENTES"

    # Entregar cada ítem en la mesa mediante el endpoint de HU-06
    for d in detalles:
        r_entrega = client.patch(
            f"{URL}/{comanda_id}/detalles/{d['id']}/entrega",
            json={"entregado": True},
        )
        assert r_entrega.status_code == 200

    # Una vez entregados todos los productos, se habilita el cierre
    r_cierre = client.post(f"{URL}/{comanda_id}/cierre")
    assert r_cierre.status_code == 200
    assert r_cierre.json()["estado"] == EstadoComanda.CERRADA
    assert r_cierre.json()["abierta"] is False


def test_hu06_ca2_producto_entregado_no_se_puede_quitar(client, escenario):
    comanda_id = _abrir_comanda(client)
    r_alta = client.post(
        f"{URL}/{comanda_id}/detalles",
        json={"producto_id": escenario["plato"].id, "cantidad": 1},
    )
    detalle_id = r_alta.json()["detalles"][0]["id"]

    client.patch(
        f"{URL}/{comanda_id}/detalles/{detalle_id}/entrega",
        json={"entregado": True},
    )

    r_quita = client.delete(f"{URL}/{comanda_id}/detalles/{detalle_id}")
    assert r_quita.status_code == 409
    assert r_quita.json()["code"] == "DETALLE_ENTREGADO"


# ---------------------------------------------------------------------------
# CA3: Cancelación / Anulación por falta de pedido indicando el motivo
# ---------------------------------------------------------------------------


def test_hu06_ca3_anula_comanda_indicando_motivo_y_libera_mesa(db, client, escenario):
    comanda_id = _abrir_comanda(client)

    r_anular = client.post(
        f"{URL}/{comanda_id}/anulacion",
        json={"motivo": "El cliente decidió retirarse sin realizar pedido"},
    )
    assert r_anular.status_code == 200
    cuerpo = r_anular.json()
    assert cuerpo["estado"] == EstadoComanda.ANULADA
    assert cuerpo["abierta"] is False
    assert (
        cuerpo["motivo_anulacion"] == "El cliente decidió retirarse sin realizar pedido"
    )
    assert cuerpo["fecha_hora_cierre"] is not None

    # La mesa vuelve a quedar libre para una nueva comanda
    nueva_id = _abrir_comanda(client)
    assert nueva_id != comanda_id


def test_hu06_ca3_rechaza_anulacion_sin_motivo_valido(client, escenario):
    comanda_id = _abrir_comanda(client)

    r_vacio = client.post(f"{URL}/{comanda_id}/anulacion", json={"motivo": "   "})
    assert r_vacio.status_code == 422


def test_hu06_ca3_bloquea_anular_si_tiene_productos_entregados(client, escenario):
    comanda_id = _abrir_comanda(client)
    r_alta = client.post(
        f"{URL}/{comanda_id}/detalles",
        json={"producto_id": escenario["plato"].id, "cantidad": 1},
    )
    detalle_id = r_alta.json()["detalles"][0]["id"]
    client.patch(
        f"{URL}/{comanda_id}/detalles/{detalle_id}/entrega",
        json={"entregado": True},
    )

    r_anular = client.post(
        f"{URL}/{comanda_id}/anulacion",
        json={"motivo": "Cliente se retira"},
    )
    assert r_anular.status_code == 409
    assert r_anular.json()["code"] == "COMANDA_CON_ENTREGAS"


def test_hu06_ca3_comanda_anulada_no_permite_modificaciones_ni_reapertura(
    client, headers, escenario
):
    comanda_id = _abrir_comanda(client)
    client.post(
        f"{URL}/{comanda_id}/anulacion",
        json={"motivo": "Cliente se retiró antes de pedir"},
    )

    # No permite volver a anular
    r_doble = client.post(
        f"{URL}/{comanda_id}/anulacion",
        json={"motivo": "Otro motivo"},
    )
    assert r_doble.status_code == 409
    assert r_doble.json()["code"] == "COMANDA_YA_ANULADA"

    # No permite agregar productos
    r_agregar = client.post(
        f"{URL}/{comanda_id}/detalles",
        json={"producto_id": escenario["plato"].id, "cantidad": 1},
    )
    assert r_agregar.status_code == 409
    assert r_agregar.json()["code"] == "COMANDA_ANULADA"

    # No permite reabrir ni siquiera como Administrador
    client.headers.update(headers(Rol.ADMINISTRADOR))
    r_reabrir = client.post(f"{URL}/{comanda_id}/reapertura")
    assert r_reabrir.status_code == 409
    assert r_reabrir.json()["code"] == "COMANDA_ANULADA"


# ---------------------------------------------------------------------------
# Tablero operativo de mesas (/api/v1/comandas/tablero-mesas)
# ---------------------------------------------------------------------------


def test_hu06_tablero_mesas_refleja_estados_del_salon(client, escenario):
    # Inicialmente la mesa 1 está libre
    r_inicial = client.get(f"{URL}/tablero-mesas")
    assert r_inicial.status_code == 200
    assert r_inicial.json()[0]["estado_mesa"] == "libre"
    assert r_inicial.json()[0]["comanda"] is None

    # Al abrir comanda pasa a ocupada
    comanda_id = _abrir_comanda(client)
    r_ocupada = client.get(f"{URL}/tablero-mesas")
    assert r_ocupada.json()[0]["estado_mesa"] == "ocupada"
    assert r_ocupada.json()[0]["comanda"]["id"] == comanda_id

    # Al anular vuelve a estar libre
    client.post(
        f"{URL}/{comanda_id}/anulacion",
        json={"motivo": "Sin consumo"},
    )
    r_final = client.get(f"{URL}/tablero-mesas")
    assert r_final.json()[0]["estado_mesa"] == "libre"
    assert r_final.json()[0]["comanda"] is None


def test_hu06_tablero_filtra_por_sector_y_actualiza_posicion_en_plano(
    db, client, escenario
):
    terraza = Sector(nombre="Terraza", activo=True)
    db.add(terraza)
    db.flush()
    mesa_terraza = Mesa(numero=9, capacidad=2, sector_id=terraza.id, activo=True)
    db.add(mesa_terraza)
    db.commit()

    # Sectores del tablero
    r_sectores = client.get(f"{URL}/sectores-tablero")
    assert r_sectores.status_code == 200
    assert [s["nombre"] for s in r_sectores.json()] == ["Salón Principal", "Terraza"]

    # Filtrar tablero por sector
    r_filtrado = client.get(f"{URL}/tablero-mesas", params={"sector_id": terraza.id})
    assert r_filtrado.status_code == 200
    assert [m["numero"] for m in r_filtrado.json()] == [9]

    # Actualizar posición (x, y) de la mesa en el plano
    r_pos = client.patch(
        f"{URL}/mesas/{mesa_terraza.id}/posicion",
        json={"pos_x": 320, "pos_y": 140},
    )
    assert r_pos.status_code == 200
    assert r_pos.json()["pos_x"] == 320
    assert r_pos.json()["pos_y"] == 140
