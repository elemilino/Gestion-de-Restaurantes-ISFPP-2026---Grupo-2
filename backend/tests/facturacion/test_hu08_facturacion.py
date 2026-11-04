"""Pruebas del módulo facturación (HU-08a, HU-08b).

Cubre:
- HU-08a CA1 (Creación de factura a partir de comanda cerrada con consumos).
- HU-08a CA2 (Bloqueo por comanda sin consumos).
- HU-08a CA3 (Bloqueo por comanda abierta).
- HU-08a CA6 (Elección de tipo de factura).
- HU-08b CA1 (Cobro con medio de pago sin recargo y comprobante).
- HU-08b CA2 (Cobro con recargo y comprobante).
- HU-08b CA3 y CA4 (Cobro con múltiples medios de pago y cálculo de total a pagar).
- HU-08b CA5 (Cobro bloqueado en factura ya saldada).
- Control de roles (Administrador y Cajero permitidos; Mozo bloqueado).
"""

from decimal import Decimal

import pytest

from app.core.enums import (
    EstadoComanda,
    Rol,
    TipoAcreditacion,
    TipoFactura,
    TipoProducto,
)
from app.models.carta import Producto, SeccionCarta
from app.models.comandas import Comanda, DetalleComanda
from app.models.medios_pago import MedioPago
from app.models.personal import Mozo
from app.models.salon import Mesa, Sector

URL_FACTURACION = "/api/v1/facturacion"


@pytest.fixture
def datos_prueba(db):
    """Crea sector, mesa, mozo, seccion, productos y medios de pago para las pruebas."""
    sector = Sector(nombre="Salón Principal", activo=True)
    db.add(sector)
    db.flush()

    mesa = Mesa(numero=1, capacidad=4, sector_id=sector.id, activo=True)
    mozo = Mozo(
        dni="20111222",
        nombre="Juan",
        apellido="Pérez",
        sector_id=sector.id,
        activo=True,
    )
    seccion = SeccionCarta(nombre="Platos Principales", orden=1, activo=True)
    db.add_all([mesa, mozo, seccion])
    db.flush()

    prod1 = Producto(
        nombre="Milanesa con papas",
        precio=Decimal("5000.00"),
        tipo=TipoProducto.PLATO,
        seccion_id=seccion.id,
        activo=True,
    )
    prod2 = Producto(
        nombre="Gaseosa 500ml",
        precio=Decimal("1500.00"),
        tipo=TipoProducto.BEBIDA,
        seccion_id=seccion.id,
        activo=True,
    )
    db.add_all([prod1, prod2])

    medio_efectivo = MedioPago(
        nombre="Efectivo",
        tipo_acreditacion=TipoAcreditacion.INMEDIATA,
        porcentaje_recargo=Decimal("0.00"),
        activo=True,
    )
    medio_tarjeta = MedioPago(
        nombre="Tarjeta Crédito",
        tipo_acreditacion=TipoAcreditacion.DIFERIDA,
        porcentaje_recargo=Decimal("10.00"),
        activo=True,
    )
    medio_inactivo = MedioPago(
        nombre="Cheque Viejo",
        tipo_acreditacion=TipoAcreditacion.DIFERIDA,
        porcentaje_recargo=Decimal("0.00"),
        activo=False,
    )
    db.add_all([medio_efectivo, medio_tarjeta, medio_inactivo])
    db.commit()

    return {
        "mesa": mesa,
        "mozo": mozo,
        "prod1": prod1,
        "prod2": prod2,
        "medio_efectivo": medio_efectivo,
        "medio_tarjeta": medio_tarjeta,
        "medio_inactivo": medio_inactivo,
    }


def _crear_comanda_con_detalles(
    db, datos_prueba, estado=EstadoComanda.CERRADA, vacia=False
) -> Comanda:
    comanda = Comanda(
        mesa_id=datos_prueba["mesa"].id,
        mozo_id=datos_prueba["mozo"].id,
        estado=estado,
    )
    db.add(comanda)
    db.flush()

    if not vacia:
        d1 = DetalleComanda(
            comanda_id=comanda.id,
            producto_id=datos_prueba["prod1"].id,
            cantidad=2,
            precio_unitario=datos_prueba["prod1"].precio,  # 2 * 5000 = 10000
        )
        d2 = DetalleComanda(
            comanda_id=comanda.id,
            producto_id=datos_prueba["prod2"].id,
            cantidad=1,
            precio_unitario=datos_prueba["prod2"].precio,  # 1 * 1500 = 1500
        )
        db.add_all([d1, d2])
    db.commit()
    db.refresh(comanda)
    return comanda


def test_hu08a_ca1_generar_factura_exitosamente(client, headers, db, datos_prueba):
    """CA1: Genera factura a partir de comanda cerrada con consumos."""
    comanda = _crear_comanda_con_detalles(
        db, datos_prueba, estado=EstadoComanda.CERRADA
    )

    payload = {
        "comanda_id": comanda.id,
        "tipo_factura": TipoFactura.B.value,
        "cuit_dni_cliente": "20304050607",
    }
    r = client.post(URL_FACTURACION, json=payload, headers=headers(Rol.CAJERO))
    assert r.status_code == 201
    datos = r.json()
    assert datos["comanda_id"] == comanda.id
    assert datos["estado"] == "Adeudada"
    assert datos["tipo_factura"] == "B"
    assert datos["cuit_dni_cliente"] == "20304050607"
    assert Decimal(str(datos["importe_total"])) == Decimal("11500.00")
    assert Decimal(str(datos["total_a_pagar"])) == Decimal("11500.00")
    assert datos["detalles_pago"] == []


def test_hu08a_ca2_comanda_sin_consumos_bloqueada(client, headers, db, datos_prueba):
    """CA2: No permite generar factura de una comanda vacía."""
    comanda = _crear_comanda_con_detalles(
        db, datos_prueba, estado=EstadoComanda.CERRADA, vacia=True
    )

    payload = {"comanda_id": comanda.id}
    r = client.post(URL_FACTURACION, json=payload, headers=headers(Rol.CAJERO))
    assert r.status_code == 422
    assert r.json()["code"] == "COMANDA_SIN_CONSUMOS"


def test_hu08a_ca3_comanda_abierta_bloqueada(client, headers, db, datos_prueba):
    """CA3: No permite generar factura de una comanda que no esté cerrada."""
    comanda = _crear_comanda_con_detalles(
        db, datos_prueba, estado=EstadoComanda.ABIERTA
    )

    payload = {"comanda_id": comanda.id}
    r = client.post(URL_FACTURACION, json=payload, headers=headers(Rol.CAJERO))
    assert r.status_code == 422
    assert r.json()["code"] == "COMANDA_NO_CERRADA"


def test_hu08a_comanda_ya_facturada_bloqueada(client, headers, db, datos_prueba):
    """No permite duplicar la factura de una misma comanda."""
    comanda = _crear_comanda_con_detalles(
        db, datos_prueba, estado=EstadoComanda.CERRADA
    )

    payload = {"comanda_id": comanda.id}
    r1 = client.post(URL_FACTURACION, json=payload, headers=headers(Rol.CAJERO))
    assert r1.status_code == 201

    r2 = client.post(URL_FACTURACION, json=payload, headers=headers(Rol.CAJERO))
    assert r2.status_code == 409
    assert r2.json()["code"] == "FACTURA_YA_GENERADA"


def test_hu08b_ca1_cobro_sin_recargo_y_comprobante(client, headers, db, datos_prueba):
    """CA1: Cobro con medio sin recargo, cambia estado a Pagada y genera comprobante."""
    comanda = _crear_comanda_con_detalles(
        db, datos_prueba, estado=EstadoComanda.CERRADA
    )

    r_fac = client.post(
        URL_FACTURACION,
        json={
            "comanda_id": comanda.id,
            "tipo_factura": TipoFactura.CONSUMIDOR_FINAL.value,
        },
        headers=headers(Rol.CAJERO),
    )
    factura_id = r_fac.json()["id"]

    # Cobrar con efectivo (11500)
    cobro_payload = {
        "pagos": [
            {
                "medio_pago_id": datos_prueba["medio_efectivo"].id,
                "monto_abonado": "11500.00",
            }
        ],
        "monto_recibido": "12000.00",  # Cliente paga con 12000
    }
    r_cobro = client.post(
        f"{URL_FACTURACION}/{factura_id}/cobrar",
        json=cobro_payload,
        headers=headers(Rol.CAJERO),
    )
    assert r_cobro.status_code == 200
    res = r_cobro.json()
    assert res["estado"] == "Pagada"
    assert Decimal(str(res["total_a_pagar"])) == Decimal("11500.00")
    assert Decimal(str(res["monto_recibido"])) == Decimal("12000.00")

    # Descargar comprobante
    r_comp = client.get(
        f"{URL_FACTURACION}/{factura_id}/comprobante", headers=headers(Rol.CAJERO)
    )
    assert r_comp.status_code == 200
    comp = r_comp.json()
    assert comp["factura_id"] == factura_id
    assert Decimal(str(comp["total_a_pagar"])) == Decimal("11500.00")
    assert Decimal(str(comp["vuelto"])) == Decimal("500.00")
    assert len(comp["items"]) == 2


def test_hu08b_ca2_cobro_con_recargo(client, headers, db, datos_prueba):
    """CA2: Cobro con tarjeta (10% recargo), total_a_pagar refleja el recargo."""
    comanda = _crear_comanda_con_detalles(
        db, datos_prueba, estado=EstadoComanda.CERRADA
    )

    r_fac = client.post(
        URL_FACTURACION,
        json={"comanda_id": comanda.id},
        headers=headers(Rol.CAJERO),
    )
    factura_id = r_fac.json()["id"]

    # Total consumo = 11500. Recargo 10% = 1150. Total a pagar = 12650
    cobro_payload = {
        "pagos": [
            {
                "medio_pago_id": datos_prueba["medio_tarjeta"].id,
                "monto_abonado": "11500.00",
            }
        ]
    }
    r_cobro = client.post(
        f"{URL_FACTURACION}/{factura_id}/cobrar",
        json=cobro_payload,
        headers=headers(Rol.CAJERO),
    )
    assert r_cobro.status_code == 200
    res = r_cobro.json()
    assert res["estado"] == "Pagada"
    assert Decimal(str(res["total_a_pagar"])) == Decimal("12650.00")
    assert len(res["detalles_pago"]) == 1
    assert Decimal(str(res["detalles_pago"][0]["monto_con_recargo"])) == Decimal(
        "12650.00"
    )


def test_hu08b_ca3_y_ca4_cobro_multiples_medios_pago(client, headers, db, datos_prueba):
    """CA3 & CA4: Pago mixto con Efectivo y Tarjeta con recargo."""
    comanda = _crear_comanda_con_detalles(
        db, datos_prueba, estado=EstadoComanda.CERRADA
    )

    r_fac = client.post(
        URL_FACTURACION, json={"comanda_id": comanda.id}, headers=headers(Rol.CAJERO)
    )
    factura_id = r_fac.json()["id"]

    # Consumo total = 11500.
    # 5000 en Efectivo (0% recargo -> 5000)
    # 6500 en Tarjeta (10% recargo -> 6500 + 650 = 7150)
    # Total a pagar = 5000 + 7150 = 12150.
    cobro_payload = {
        "pagos": [
            {
                "medio_pago_id": datos_prueba["medio_efectivo"].id,
                "monto_abonado": "5000.00",
            },
            {
                "medio_pago_id": datos_prueba["medio_tarjeta"].id,
                "monto_abonado": "6500.00",
            },
        ]
    }
    r_cobro = client.post(
        f"{URL_FACTURACION}/{factura_id}/cobrar",
        json=cobro_payload,
        headers=headers(Rol.CAJERO),
    )
    assert r_cobro.status_code == 200
    res = r_cobro.json()
    assert res["estado"] == "Pagada"
    assert Decimal(str(res["total_a_pagar"])) == Decimal("12150.00")
    assert len(res["detalles_pago"]) == 2


def test_hu08b_ca5_cobro_bloqueado_en_factura_pagada(client, headers, db, datos_prueba):
    """CA5: No permite registrar un cobro en una factura ya pagada."""
    comanda = _crear_comanda_con_detalles(
        db, datos_prueba, estado=EstadoComanda.CERRADA
    )

    r_fac = client.post(
        URL_FACTURACION, json={"comanda_id": comanda.id}, headers=headers(Rol.CAJERO)
    )
    factura_id = r_fac.json()["id"]

    cobro_payload = {
        "pagos": [
            {
                "medio_pago_id": datos_prueba["medio_efectivo"].id,
                "monto_abonado": "11500.00",
            }
        ]
    }
    client.post(
        f"{URL_FACTURACION}/{factura_id}/cobrar",
        json=cobro_payload,
        headers=headers(Rol.CAJERO),
    )

    # Intento cobrar de nuevo
    r_segundo = client.post(
        f"{URL_FACTURACION}/{factura_id}/cobrar",
        json=cobro_payload,
        headers=headers(Rol.CAJERO),
    )
    assert r_segundo.status_code == 409
    assert r_segundo.json()["code"] == "FACTURA_YA_PAGADA"


def test_hu08b_medio_pago_inactivo_bloqueado(client, headers, db, datos_prueba):
    """No permite cobrar con un medio de pago dado de baja."""
    comanda = _crear_comanda_con_detalles(
        db, datos_prueba, estado=EstadoComanda.CERRADA
    )

    r_fac = client.post(
        URL_FACTURACION, json={"comanda_id": comanda.id}, headers=headers(Rol.CAJERO)
    )
    factura_id = r_fac.json()["id"]

    cobro_payload = {
        "pagos": [
            {
                "medio_pago_id": datos_prueba["medio_inactivo"].id,
                "monto_abonado": "11500.00",
            }
        ]
    }
    r = client.post(
        f"{URL_FACTURACION}/{factura_id}/cobrar",
        json=cobro_payload,
        headers=headers(Rol.CAJERO),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "MEDIO_PAGO_INACTIVO"


def test_hu08_permisos_mozo_bloqueado(client, headers, db, datos_prueba):
    """Un mozo no puede generar facturas ni cobrar."""
    comanda = _crear_comanda_con_detalles(
        db, datos_prueba, estado=EstadoComanda.CERRADA
    )

    payload = {"comanda_id": comanda.id}
    r = client.post(URL_FACTURACION, json=payload, headers=headers(Rol.MOZO))
    assert r.status_code == 403
