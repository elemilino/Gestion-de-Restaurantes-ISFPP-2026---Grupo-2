import pytest

from datetime import datetime, timedelta
from decimal import Decimal
from app.core.enums import EstadoComanda, Rol, TipoProducto
from app.models.carta import Producto, SeccionCarta

from app.models.comandas import Comanda, DetalleComanda, comanda_mesa
from app.models.facturacion import Factura
from app.models.personal import Mozo
from app.models.salon import Mesa, Sector

from sqlalchemy import select

URL = "/api/v1/comandas"
DNI = "12345678"

"""Login agregado"""


@pytest.fixture(autouse=True)
def sesion_mozo(client, headers):
    """Todas las pruebas del módulo parten con un mozo logueado."""
    client.headers.update(headers(Rol.MOZO))


@pytest.fixture
def sector(db):
    sector = Sector(nombre="Salón")
    db.add(sector)
    db.commit()
    return sector


# Asignarle al mozo el mismo sector que usan las mesas.
@pytest.fixture
def crear_mozo(db, sector):
    def _crear(dni=DNI, activo=True) -> Mozo:
        mozo = Mozo(
            dni=dni,
            nombre="Juan",
            apellido="Pérez",
            activo=activo,
            sector_id=sector.id,
        )
        db.add(mozo)
        db.commit()
        return mozo

    return _crear


@pytest.fixture
def crear_mesa(db, sector):
    def _crear(numero=1, capacidad=4, activo=True) -> Mesa:
        mesa = Mesa(
            numero=numero, capacidad=capacidad, sector_id=sector.id, activo=activo
        )
        db.add(mesa)
        db.commit()
        return mesa

    return _crear


def _datos(dni=DNI, comensales=2, mesas=(1,)) -> dict:
    return {
        "dni_mozo": dni,
        "cantidad_comensales": comensales,
        "numeros_mesa": list(mesas),
    }


def test_hu05a_ca1_crea_comanda_abierta(client, crear_mozo, crear_mesa):
    crear_mozo()
    crear_mesa(numero=1, capacidad=4)
    r = client.post(URL, json=_datos())
    assert r.status_code == 201
    cuerpo = r.json()
    assert cuerpo["abierta"] is True
    assert cuerpo["fecha_hora_cierre"] is None
    assert cuerpo["fecha_hora_apertura"]
    assert cuerpo["cantidad_comensales"] == 2
    assert cuerpo["mozo"]["dni"] == DNI
    assert [m["numero"] for m in cuerpo["mesas"]] == [1]


def test_hu05a_ca1_crea_comanda_con_varias_mesas(client, crear_mozo, crear_mesa):
    crear_mozo()
    crear_mesa(numero=1, capacidad=2)
    crear_mesa(numero=2, capacidad=2)
    r = client.post(URL, json=_datos(comensales=4, mesas=(1, 2)))
    assert r.status_code == 201
    assert len(r.json()["mesas"]) == 2


def test_hu05a_ca2_mozo_inexistente(client, crear_mesa):
    crear_mesa()
    r = client.post(URL, json=_datos(dni="99999999"))
    assert r.status_code == 422
    assert r.json()["code"] == "MOZO_INEXISTENTE"


def test_hu05a_ca3_mozo_eliminado(client, crear_mozo, crear_mesa):
    crear_mozo(activo=False)
    crear_mesa()
    r = client.post(URL, json=_datos())
    assert r.status_code == 422
    assert r.json()["code"] == "MOZO_ELIMINADO"


def test_hu05a_ca4_mesa_inexistente(client, crear_mozo):
    crear_mozo()
    r = client.post(URL, json=_datos(mesas=(99,)))
    assert r.status_code == 422
    assert r.json()["code"] == "MESA_INEXISTENTE"


def test_hu05a_ca4_mesa_eliminada(client, crear_mozo, crear_mesa):
    crear_mozo()
    crear_mesa(numero=1, activo=False)
    r = client.post(URL, json=_datos())
    assert r.status_code == 422
    assert r.json()["code"] == "MESA_INEXISTENTE"


@pytest.mark.skipif(
    not hasattr(Mozo, "sector_id"),
    reason="Pendiente: HU-02 agrega Mozo.sector_id",
)
def test_hu05a_ca5_mesa_de_otro_sector(db, client, crear_mozo, crear_mesa):
    otro = Sector(nombre="Terraza")
    db.add(otro)
    db.commit()
    mozo = crear_mozo()
    mozo.sector_id = otro.id
    db.commit()
    crear_mesa(numero=1)  # pertenece a `sector`, no al de `otro`
    r = client.post(URL, json=_datos())
    assert r.status_code == 422
    assert r.json()["code"] == "MESA_FUERA_DE_SECTOR"


def test_hu05a_comensales_superan_sillas(client, crear_mozo, crear_mesa):
    crear_mozo()
    crear_mesa(numero=1, capacidad=4)
    r = client.post(URL, json=_datos(comensales=5))
    assert r.status_code == 422
    assert r.json()["code"] == "COMENSALES_SUPERAN_SILLAS"


@pytest.mark.parametrize("comensales", [0, -1])
def test_hu05a_comensales_no_positivos(client, crear_mozo, crear_mesa, comensales):
    crear_mozo()
    crear_mesa()
    r = client.post(URL, json=_datos(comensales=comensales))
    assert r.status_code == 422


def test_hu05a_comensales_vacio(client, crear_mozo, crear_mesa):
    crear_mozo()
    crear_mesa()
    datos = _datos()
    del datos["cantidad_comensales"]
    assert client.post(URL, json=datos).status_code == 422


def test_hu05a_sin_mesas(client, crear_mozo):
    crear_mozo()
    r = client.post(URL, json=_datos(mesas=()))
    assert r.status_code == 422


def test_hu05a_mesa_repetida_en_el_pedido(client, crear_mozo, crear_mesa):
    crear_mozo()
    crear_mesa(numero=1)
    r = client.post(URL, json=_datos(mesas=(1, 1)))
    assert r.status_code == 422


def test_hu05a_dni_con_letras(client, crear_mozo, crear_mesa):
    crear_mozo()
    crear_mesa()
    r = client.post(URL, json=_datos(dni="12ab5678"))
    assert r.status_code == 422


def test_hu05a_mesa_ocupada(client, crear_mozo, crear_mesa):
    crear_mozo()
    crear_mesa(numero=1)
    assert client.post(URL, json=_datos()).status_code == 201
    r = client.post(URL, json=_datos())
    assert r.status_code == 409
    assert r.json()["code"] == "MESA_OCUPADA"


def test_hu05a_mesa_vuelve_a_estar_libre_al_cerrar(db, client, crear_mozo, crear_mesa):
    from datetime import datetime

    crear_mozo()
    crear_mesa(numero=1)
    id_comanda = client.post(URL, json=_datos()).json()["id"]
    comanda = db.get(Comanda, id_comanda)
    comanda.estado = EstadoComanda.CERRADA
    comanda.fecha_hora_cierre = datetime.now()
    db.commit()
    assert client.post(URL, json=_datos()).status_code == 201


# ---------------------------------------------------------------- HU-05b
@pytest.fixture
def seccion(db):
    seccion = SeccionCarta(nombre="Principales")
    db.add(seccion)
    db.commit()
    return seccion


@pytest.fixture
def crear_producto(db, seccion):
    def _crear(nombre="Milanesa", precio="1500.00", activo=True) -> Producto:
        producto = Producto(
            nombre=nombre,
            precio=Decimal(precio),
            tipo=TipoProducto.PLATO,
            seccion_id=seccion.id,
            activo=activo,
        )
        db.add(producto)
        db.commit()
        return producto

    return _crear


@pytest.fixture
def comanda_id(client, crear_mozo, crear_mesa) -> int:
    crear_mozo()
    crear_mesa(numero=1, capacidad=4)
    return client.post(URL, json=_datos()).json()["id"]


def _agregar(client, comanda_id, producto_id, cantidad=1):
    return client.post(
        f"{URL}/{comanda_id}/detalles",
        json={"producto_id": producto_id, "cantidad": cantidad},
    )


def _cerrar(db, comanda_id):
    comanda = db.get(Comanda, comanda_id)
    comanda.estado = EstadoComanda.CERRADA
    comanda.fecha_hora_cierre = datetime.now()
    db.commit()


def test_hu05b_ca1_agrega_producto_nuevo(client, comanda_id, crear_producto):
    producto = crear_producto()
    r = _agregar(client, comanda_id, producto.id, cantidad=2)
    assert r.status_code == 200
    detalles = r.json()["detalles"]
    assert len(detalles) == 1
    assert detalles[0]["producto"]["id"] == producto.id
    assert detalles[0]["cantidad"] == 2
    assert detalles[0]["entregado"] is False


def test_hu05b_ca2_producto_repetido_suma_cantidad(client, comanda_id, crear_producto):
    producto = crear_producto()
    _agregar(client, comanda_id, producto.id, cantidad=2)
    r = _agregar(client, comanda_id, producto.id, cantidad=3)
    assert r.status_code == 200
    detalles = r.json()["detalles"]
    assert len(detalles) == 1
    assert detalles[0]["cantidad"] == 5


def test_hu05b_ca2_sumar_a_un_detalle_entregado_lo_marca_pendiente(
    db, client, comanda_id, crear_producto
):
    producto = crear_producto()
    detalle_id = _agregar(client, comanda_id, producto.id).json()["detalles"][0]["id"]
    detalle = db.get(Comanda, comanda_id).detalles[0]
    assert detalle.id == detalle_id
    detalle.entregado = True
    db.commit()
    r = _agregar(client, comanda_id, producto.id, cantidad=1)
    assert r.json()["detalles"][0]["entregado"] is False


def test_hu05b_ca3_quita_producto(client, comanda_id, crear_producto):
    producto = crear_producto()
    detalle_id = _agregar(client, comanda_id, producto.id).json()["detalles"][0]["id"]
    r = client.delete(f"{URL}/{comanda_id}/detalles/{detalle_id}")
    assert r.status_code == 200
    assert r.json()["detalles"] == []


def test_hu05b_ca4_cambia_cantidad(client, comanda_id, crear_producto):
    producto = crear_producto()
    detalle_id = _agregar(client, comanda_id, producto.id, 2).json()["detalles"][0][
        "id"
    ]
    r = client.patch(f"{URL}/{comanda_id}/detalles/{detalle_id}", json={"cantidad": 7})
    assert r.status_code == 200
    assert r.json()["detalles"][0]["cantidad"] == 7


def test_hu05b_ca5_comanda_cerrada_bloquea_toda_modificacion(
    db, client, comanda_id, crear_producto
):
    producto = crear_producto()
    detalle_id = _agregar(client, comanda_id, producto.id).json()["detalles"][0]["id"]
    _cerrar(db, comanda_id)
    respuestas = [
        _agregar(client, comanda_id, producto.id),
        client.patch(f"{URL}/{comanda_id}/detalles/{detalle_id}", json={"cantidad": 3}),
        client.delete(f"{URL}/{comanda_id}/detalles/{detalle_id}"),
        client.patch(f"{URL}/{comanda_id}", json={"cantidad_comensales": 3}),
    ]
    for r in respuestas:
        assert r.status_code == 409
        assert r.json()["code"] == "COMANDA_CERRADA"


def _facturar(db, comanda_id) -> Factura:
    """Genera una factura Adeudada para la comanda, como hace HU-08a."""
    factura = Factura(
        comanda_id=comanda_id,
        importe_total=Decimal("1000.00"),
        total_a_pagar=Decimal("1000.00"),
    )
    db.add(factura)
    db.commit()
    db.expire_all()
    return factura


def test_hu05b_ca6_comanda_facturada_bloquea_modificacion(
    db, client, comanda_id, crear_producto
):
    producto = crear_producto()
    detalle_id = _agregar(client, comanda_id, producto.id).json()["detalles"][0]["id"]
    _entregar_todo(db, comanda_id)
    assert _cerrar_comanda(client, comanda_id).status_code == 200
    _facturar(db, comanda_id)
    respuestas = [
        _agregar(client, comanda_id, producto.id),
        client.patch(f"{URL}/{comanda_id}/detalles/{detalle_id}", json={"cantidad": 3}),
        client.patch(f"{URL}/{comanda_id}", json={"cantidad_comensales": 3}),
    ]
    for r in respuestas:
        assert r.status_code == 409
        assert r.json()["code"] == "COMANDA_FACTURADA"


def test_hu05b_ca7_producto_inexistente(client, comanda_id):
    r = _agregar(client, comanda_id, producto_id=999)
    assert r.status_code == 422
    assert r.json()["code"] == "PRODUCTO_NO_DISPONIBLE"


def test_hu05b_ca7_producto_eliminado(client, comanda_id, crear_producto):
    producto = crear_producto(activo=False)
    r = _agregar(client, comanda_id, producto.id)
    assert r.status_code == 422
    assert r.json()["code"] == "PRODUCTO_NO_DISPONIBLE"


@pytest.mark.parametrize("cantidad", [0, -1])
def test_hu05b_agregar_con_cantidad_no_positiva(
    client, comanda_id, crear_producto, cantidad
):
    producto = crear_producto()
    assert _agregar(client, comanda_id, producto.id, cantidad).status_code == 422


@pytest.mark.parametrize("cantidad", [0, -1])
def test_hu05b_cambiar_a_cantidad_no_positiva(
    client, comanda_id, crear_producto, cantidad
):
    producto = crear_producto()
    detalle_id = _agregar(client, comanda_id, producto.id).json()["detalles"][0]["id"]
    r = client.patch(
        f"{URL}/{comanda_id}/detalles/{detalle_id}", json={"cantidad": cantidad}
    )
    assert r.status_code == 422


def test_hu05b_comanda_inexistente(client, crear_producto):
    producto = crear_producto()
    r = _agregar(client, 999, producto.id)
    assert r.status_code == 404
    assert r.json()["code"] == "COMANDA_INEXISTENTE"


def test_hu05b_detalle_inexistente(client, comanda_id):
    r = client.delete(f"{URL}/{comanda_id}/detalles/999")
    assert r.status_code == 404
    assert r.json()["code"] == "DETALLE_INEXISTENTE"


def test_hu05b_cambia_cantidad_de_comensales(client, comanda_id):
    r = client.patch(f"{URL}/{comanda_id}", json={"cantidad_comensales": 3})
    assert r.status_code == 200
    assert r.json()["cantidad_comensales"] == 3


def test_hu05b_comensales_superan_sillas(client, comanda_id):
    r = client.patch(f"{URL}/{comanda_id}", json={"cantidad_comensales": 5})
    assert r.status_code == 422
    assert r.json()["code"] == "COMENSALES_SUPERAN_SILLAS"


def test_hu05b_comensales_en_cero(client, comanda_id):
    r = client.patch(f"{URL}/{comanda_id}", json={"cantidad_comensales": 0})
    assert r.status_code == 422


def test_hu05b_cambia_el_mozo(client, comanda_id, crear_mozo):
    crear_mozo(dni="87654321")
    r = client.patch(f"{URL}/{comanda_id}", json={"dni_mozo": "87654321"})
    assert r.status_code == 200
    assert r.json()["mozo"]["dni"] == "87654321"


def test_hu05b_cambiar_a_mozo_inexistente(client, comanda_id):
    r = client.patch(f"{URL}/{comanda_id}", json={"dni_mozo": "99999999"})
    assert r.status_code == 422
    assert r.json()["code"] == "MOZO_INEXISTENTE"


def test_hu05b_cambiar_a_mozo_eliminado(client, comanda_id, crear_mozo):
    crear_mozo(dni="87654321", activo=False)
    r = client.patch(f"{URL}/{comanda_id}", json={"dni_mozo": "87654321"})
    assert r.status_code == 422
    assert r.json()["code"] == "MOZO_ELIMINADO"


def test_hu05b_modificacion_sin_datos(client, comanda_id):
    assert client.patch(f"{URL}/{comanda_id}", json={}).status_code == 422


def test_hu05b_si_una_validacion_falla_no_se_cambia_nada(
    db, client, comanda_id, crear_mozo
):
    crear_mozo(dni="87654321")
    r = client.patch(
        f"{URL}/{comanda_id}",
        json={"dni_mozo": "87654321", "cantidad_comensales": 99},
    )
    assert r.status_code == 422
    assert db.get(Comanda, comanda_id).mozo.dni == DNI


# Marca el detalle como entregado directo en la base,
# porque el endpoint de entrega todavía no existe (HU-06).


def test_hu05b_ca8_no_se_puede_quitar_un_producto_entregado(
    db, client, comanda_id, crear_producto
):
    producto = crear_producto()
    detalle_id = _agregar(client, comanda_id, producto.id).json()["detalles"][0]["id"]
    db.get(Comanda, comanda_id).detalles[0].entregado = True
    db.commit()
    r = client.delete(f"{URL}/{comanda_id}/detalles/{detalle_id}")
    assert r.status_code == 409
    assert r.json()["code"] == "DETALLE_ENTREGADO"
    assert len(db.get(Comanda, comanda_id).detalles) == 1


def test_hu05b_el_precio_queda_congelado_al_agregar(
    db, client, comanda_id, crear_producto
):
    producto = crear_producto(precio="1500.00")
    _agregar(client, comanda_id, producto.id)
    producto.precio = Decimal("2000.00")
    db.commit()
    detalle = db.get(Comanda, comanda_id).detalles[0]
    assert detalle.precio_unitario == Decimal("1500.00")


# ----- LGIN
def test_comandas_sin_sesion_devuelve_401(client):
    client.headers.pop("Authorization")
    assert client.post(URL, json=_datos()).status_code == 401
    assert client.patch(f"{URL}/1", json={"cantidad_comensales": 2}).status_code == 401


def test_comandas_administrador_tambien_tiene_acceso(
    client, headers, crear_mozo, crear_mesa
):
    crear_mozo()
    crear_mesa()
    client.headers.update(headers(Rol.ADMINISTRADOR))
    assert client.post(URL, json=_datos()).status_code == 201


# cambios de no se elimina detalle ya entregado
def _detalle_entregado(db, client, comanda_id, producto, cantidad=3) -> int:
    detalle_id = _agregar(client, comanda_id, producto.id, cantidad).json()["detalles"][
        0
    ]["id"]
    db.get(Comanda, comanda_id).detalles[0].entregado = True
    db.commit()
    return detalle_id


def test_hu05b_ca9_no_se_reduce_la_cantidad_de_un_entregado(
    db, client, comanda_id, crear_producto
):
    detalle_id = _detalle_entregado(db, client, comanda_id, crear_producto())
    r = client.patch(f"{URL}/{comanda_id}/detalles/{detalle_id}", json={"cantidad": 1})
    assert r.status_code == 409
    assert r.json()["code"] == "DETALLE_ENTREGADO"
    assert db.get(Comanda, comanda_id).detalles[0].cantidad == 3


def test_hu05b_ca10_aumentar_un_entregado_lo_marca_pendiente(
    db, client, comanda_id, crear_producto
):
    detalle_id = _detalle_entregado(db, client, comanda_id, crear_producto())
    r = client.patch(f"{URL}/{comanda_id}/detalles/{detalle_id}", json={"cantidad": 5})
    assert r.status_code == 200
    assert r.json()["detalles"][0]["cantidad"] == 5
    assert r.json()["detalles"][0]["entregado"] is False


def test_hu05b_misma_cantidad_en_un_entregado_no_cambia_nada(
    db, client, comanda_id, crear_producto
):
    detalle_id = _detalle_entregado(db, client, comanda_id, crear_producto())
    r = client.patch(f"{URL}/{comanda_id}/detalles/{detalle_id}", json={"cantidad": 3})
    assert r.status_code == 200
    assert r.json()["detalles"][0]["entregado"] is True


# HU-05c
def _entregar_todo(db, comanda_id):
    for detalle in db.get(Comanda, comanda_id).detalles:
        detalle.entregado = True
    db.commit()


def _cerrar_comanda(client, comanda_id):
    return client.post(f"{URL}/{comanda_id}/cierre")


def test_hu05c_ca1_cierra_la_comanda_con_fecha_de_cierre(
    db, client, comanda_id, crear_producto
):
    milanesa = crear_producto(nombre="Milanesa", precio="1000.00")
    flan = crear_producto(nombre="Flan", precio="500.00")
    _agregar(client, comanda_id, milanesa.id, cantidad=2)
    _agregar(client, comanda_id, flan.id, cantidad=1)
    _entregar_todo(db, comanda_id)

    r = _cerrar_comanda(client, comanda_id)
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["abierta"] is False
    assert cuerpo["fecha_hora_cierre"] is not None


def test_hu05c_el_cierre_bloquea_modificaciones(db, client, comanda_id, crear_producto):
    producto = crear_producto()
    _agregar(client, comanda_id, producto.id)
    _entregar_todo(db, comanda_id)
    _cerrar_comanda(client, comanda_id)

    r = _agregar(client, comanda_id, producto.id)
    assert r.status_code == 409
    assert r.json()["code"] == "COMANDA_CERRADA"


def test_hu05c_regla_vigente_el_cierre_libera_la_mesa(
    db, client, comanda_id, crear_producto
):
    """Depende de la decisión del grupo (liberar al cerrar o al facturar)."""
    producto = crear_producto()
    _agregar(client, comanda_id, producto.id)
    _entregar_todo(db, comanda_id)
    _cerrar_comanda(client, comanda_id)
    assert client.post(URL, json=_datos()).status_code == 201  # mesa 1 libre


def test_hu05c_ca2_comanda_ya_cerrada(db, client, comanda_id, crear_producto):
    producto = crear_producto()
    _agregar(client, comanda_id, producto.id)
    _entregar_todo(db, comanda_id)
    _cerrar_comanda(client, comanda_id)

    r = _cerrar_comanda(client, comanda_id)
    assert r.status_code == 409
    assert r.json()["code"] == "COMANDA_YA_CERRADA"


def test_hu05c_ca3_productos_pendientes_de_entrega(
    db, client, comanda_id, crear_producto
):
    producto = crear_producto(nombre="Milanesa")
    _agregar(client, comanda_id, producto.id)

    r = _cerrar_comanda(client, comanda_id)
    assert r.status_code == 409
    assert r.json()["code"] == "PRODUCTOS_PENDIENTES"
    assert "Milanesa" in r.json()["detail"]
    assert db.get(Comanda, comanda_id).abierta is True


def test_hu05c_comanda_sin_productos(db, client, comanda_id):
    r = _cerrar_comanda(client, comanda_id)
    assert r.status_code == 422
    assert r.json()["code"] == "COMANDA_SIN_PRODUCTOS"
    assert db.get(Comanda, comanda_id).abierta is True


def test_hu05c_comanda_inexistente(client):
    r = _cerrar_comanda(client, 999)
    assert r.status_code == 404
    assert r.json()["code"] == "COMANDA_INEXISTENTE"


def test_hu05c_cierre_sin_sesion_devuelve_401(client, comanda_id):
    client.headers.pop("Authorization")
    assert _cerrar_comanda(client, comanda_id).status_code == 401


#
# ---------------------------------------------------------------- HU-05d
def _reabrir(client, comanda_id):
    return client.post(f"{URL}/{comanda_id}/reapertura")


@pytest.fixture
def comanda_cerrada_id(db, client, comanda_id, crear_producto) -> int:
    producto = crear_producto()
    _agregar(client, comanda_id, producto.id)
    _entregar_todo(db, comanda_id)
    _cerrar_comanda(client, comanda_id)
    return comanda_id


def test_hu05d_ca1_reabre_la_comanda(client, headers, comanda_cerrada_id):
    client.headers.update(headers(Rol.ADMINISTRADOR))
    r = _reabrir(client, comanda_cerrada_id)
    assert r.status_code == 200
    assert r.json()["abierta"] is True
    assert r.json()["fecha_hora_cierre"] is None


def test_hu05d_reabierta_permite_modificar_y_conserva_entregas(
    client, headers, comanda_cerrada_id, crear_producto
):
    client.headers.update(headers(Rol.ADMINISTRADOR))
    _reabrir(client, comanda_cerrada_id)
    r = _agregar(client, comanda_cerrada_id, crear_producto(nombre="Flan").id)
    assert r.status_code == 200
    entregados = {d["producto"]["nombre"]: d["entregado"] for d in r.json()["detalles"]}
    assert entregados == {"Milanesa": True, "Flan": False}


def test_hu05d_ca2_comanda_facturada_no_se_reabre(
    db, client, headers, comanda_cerrada_id
):
    # La factura está Adeudada: la comanda sigue CERRADA hasta el cobro.
    _facturar(db, comanda_cerrada_id)
    client.headers.update(headers(Rol.ADMINISTRADOR))
    r = _reabrir(client, comanda_cerrada_id)
    assert r.status_code == 409
    assert r.json()["code"] == "COMANDA_FACTURADA"


def test_hu05d_comanda_ya_abierta(client, headers, comanda_id):
    client.headers.update(headers(Rol.ADMINISTRADOR))
    r = _reabrir(client, comanda_id)
    assert r.status_code == 409
    assert r.json()["code"] == "COMANDA_YA_ABIERTA"


def test_hu05d_comanda_inexistente(client, headers):
    client.headers.update(headers(Rol.ADMINISTRADOR))
    r = _reabrir(client, 999)
    assert r.status_code == 404
    assert r.json()["code"] == "COMANDA_INEXISTENTE"


def test_hu05d_mozo_no_puede_reabrir(db, client, comanda_cerrada_id):
    r = _reabrir(client, comanda_cerrada_id)  # sesión de mozo por defecto
    assert r.status_code == 403
    assert db.get(Comanda, comanda_cerrada_id).abierta is False


def test_hu05d_sin_sesion_devuelve_401(client, comanda_cerrada_id):
    client.headers.pop("Authorization")
    assert _reabrir(client, comanda_cerrada_id).status_code == 401


#
# ---------------------------------------------------------------- HU-05e
def _eliminar(client, comanda_id):
    return client.delete(f"{URL}/{comanda_id}")


def test_hu05e_ca1_elimina_comanda_abierta(db, client, comanda_id):
    r = _eliminar(client, comanda_id)
    assert r.status_code == 204
    assert db.get(Comanda, comanda_id) is None


def test_hu05e_eliminar_borra_sus_detalles_y_vinculos_con_mesas(
    db, client, comanda_id, crear_producto
):
    _agregar(client, comanda_id, crear_producto().id)
    _eliminar(client, comanda_id)
    assert db.scalars(select(DetalleComanda)).all() == []
    assert db.execute(select(comanda_mesa)).all() == []


def test_hu05e_eliminar_con_productos_sin_entregar_esta_permitido(
    db, client, comanda_id, crear_producto
):
    _agregar(client, comanda_id, crear_producto().id)
    assert _eliminar(client, comanda_id).status_code == 204


def test_hu05e_eliminar_libera_la_mesa(client, comanda_id):
    _eliminar(client, comanda_id)
    assert client.post(URL, json=_datos()).status_code == 201


def test_hu05e_ca2_comanda_cerrada_no_se_elimina(
    db, client, comanda_id, crear_producto
):
    _agregar(client, comanda_id, crear_producto().id)
    _entregar_todo(db, comanda_id)
    _cerrar_comanda(client, comanda_id)
    r = _eliminar(client, comanda_id)
    assert r.status_code == 409
    assert r.json()["code"] == "COMANDA_CERRADA"
    assert db.get(Comanda, comanda_id) is not None


def test_hu05e_ca3_comanda_con_productos_entregados(
    db, client, comanda_id, crear_producto
):
    _agregar(client, comanda_id, crear_producto().id)
    _entregar_todo(db, comanda_id)
    r = _eliminar(client, comanda_id)
    assert r.status_code == 409
    assert r.json()["code"] == "COMANDA_CON_ENTREGAS"
    assert db.get(Comanda, comanda_id) is not None


def test_hu05e_comanda_inexistente(client):
    r = _eliminar(client, 999)
    assert r.status_code == 404
    assert r.json()["code"] == "COMANDA_INEXISTENTE"


def test_hu05e_sin_sesion_devuelve_401(client, comanda_id):
    client.headers.pop("Authorization")
    assert _eliminar(client, comanda_id).status_code == 401


#
# ---------------------------------------------------------------- HU-05f
def _listar(client, **params):
    return client.get(URL, params=params)


@pytest.fixture
def dos_comandas(db, client, crear_mozo, crear_mesa):
    """Comanda 1 de Juan (mesa 1) y comanda 2 de Ana (mesa 2)."""
    crear_mozo(dni=DNI)
    crear_mozo(dni="87654321")
    crear_mesa(numero=1)
    crear_mesa(numero=2)
    c1 = client.post(URL, json=_datos(mesas=(1,))).json()["id"]
    c2 = client.post(URL, json=_datos(dni="87654321", mesas=(2,))).json()["id"]
    return c1, c2


def test_hu05f_ca1_sin_filtros_lista_todas(client, dos_comandas):
    r = _listar(client)
    assert r.status_code == 200
    assert {c["id"] for c in r.json()} == set(dos_comandas)


def test_hu05f_ca1_filtra_por_mozo(client, dos_comandas):
    r = _listar(client, dni_mozo="87654321")
    assert [c["id"] for c in r.json()] == [dos_comandas[1]]


def test_hu05f_ca1_filtra_por_rango_de_fechas(db, client, dos_comandas):
    c1, c2 = dos_comandas
    db.get(Comanda, c1).fecha_hora_apertura = datetime.now() - timedelta(days=10)
    db.commit()
    hoy = datetime.now().date().isoformat()
    r = _listar(client, fecha_desde=hoy, fecha_hasta=hoy)
    assert [c["id"] for c in r.json()] == [c2]


def test_hu05f_ca1_filtra_por_estado(db, client, dos_comandas):
    c1, c2 = dos_comandas
    _cerrar(db, c1)
    assert [c["id"] for c in _listar(client, abierta=True).json()] == [c2]
    assert [c["id"] for c in _listar(client, abierta=False).json()] == [c1]


def test_hu05f_ca2_mozo_inexistente(client, dos_comandas):
    r = _listar(client, dni_mozo="99999999")
    assert r.status_code == 422
    assert r.json()["code"] == "MOZO_INEXISTENTE_O_ELIMINADO"


def test_hu05f_ca2_mozo_eliminado(db, client, dos_comandas):
    db.scalars(select(Mozo).where(Mozo.dni == "87654321")).first().activo = False
    db.commit()
    r = _listar(client, dni_mozo="87654321")
    assert r.status_code == 422


def test_hu05f_sin_resultados_devuelve_lista_vacia(client, dos_comandas):
    r = _listar(client, fecha_desde="2000-01-01", fecha_hasta="2000-01-02")
    assert r.status_code == 200
    assert r.json() == []


def test_hu05f_rango_de_fechas_invertido(client, dos_comandas):
    r = _listar(client, fecha_desde="2026-02-01", fecha_hasta="2026-01-01")
    assert r.status_code == 422
    assert r.json()["code"] == "RANGO_FECHAS_INVALIDO"


def test_hu05f_las_eliminadas_no_aparecen(client, dos_comandas):
    c1, c2 = dos_comandas
    client.delete(f"{URL}/{c1}")
    assert [c["id"] for c in _listar(client).json()] == [c2]


def test_hu05f_listar_sin_sesion_devuelve_401(client):
    client.headers.pop("Authorization")
    assert _listar(client).status_code == 401
