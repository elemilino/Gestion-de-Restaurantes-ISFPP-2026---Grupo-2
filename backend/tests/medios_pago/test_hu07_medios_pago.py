"""Pruebas del módulo medios_pago (HU-07a, HU-07b).

Cubre:
- HU-07a CA1 (Creación y listado de medios de pago).
- HU-07a CA2 (Creación bloqueada por duplicado).
- HU-07b CA1 (Baja lógica).
- HU-07b CA2 (Modificación bloqueada por recargo negativo).
- Permisos por rol (solo administrador puede crear, editar o eliminar).
"""

from decimal import Decimal

from app.core.enums import Rol, TipoAcreditacion
from app.models.medios_pago import MedioPago

URL = "/api/v1/medios-pago"


def test_hu07a_ca1_crea_medio_pago_exitosamente(client, headers, db):
    """CA1: Registra un nuevo medio de pago y actualiza el listado."""
    payload = {
        "nombre": "Efectivo",
        "tipo_acreditacion": TipoAcreditacion.INMEDIATA.value,
        "porcentaje_recargo": "0.00",
    }
    r = client.post(URL, json=payload, headers=headers(Rol.ADMINISTRADOR))
    assert r.status_code == 201
    datos = r.json()
    assert datos["nombre"] == "Efectivo"
    assert datos["tipo_acreditacion"] == "Inmediata"
    assert Decimal(str(datos["porcentaje_recargo"])) == Decimal("0.00")
    assert datos["activo"] is True

    # Verificar que aparece en el listado
    r_list = client.get(URL, headers=headers(Rol.ADMINISTRADOR))
    assert r_list.status_code == 200
    assert any(m["nombre"] == "Efectivo" for m in r_list.json())


def test_hu07a_ca2_creacion_bloqueada_por_nombre_duplicado(client, headers, db):
    """CA2: Si el nombre ya está registrado, advierte el duplicado."""
    db.add(
        MedioPago(
            nombre="MercadoPago",
            tipo_acreditacion=TipoAcreditacion.INMEDIATA,
            porcentaje_recargo=Decimal("0.00"),
            activo=True,
        )
    )
    db.commit()

    payload = {
        "nombre": "mercadopago",  # Case insensitive
        "tipo_acreditacion": TipoAcreditacion.INMEDIATA.value,
        "porcentaje_recargo": "5.00",
    }
    r = client.post(URL, json=payload, headers=headers(Rol.ADMINISTRADOR))
    assert r.status_code == 409
    assert r.json()["code"] == "MEDIO_PAGO_DUPLICADO"


def test_hu07b_ca1_baja_logica_medio_pago(client, headers, db):
    """HU-07b CA1: Cambia el estado activo a False y queda fuera de los activos."""
    medio = MedioPago(
        nombre="Cheque",
        tipo_acreditacion=TipoAcreditacion.DIFERIDA,
        porcentaje_recargo=Decimal("0.00"),
        activo=True,
    )
    db.add(medio)
    db.commit()

    # Eliminar
    r_del = client.delete(f"{URL}/{medio.id}", headers=headers(Rol.ADMINISTRADOR))
    assert r_del.status_code == 204

    # Verificar en el listado general (se conserva)
    r_all = client.get(URL, headers=headers(Rol.ADMINISTRADOR))
    assert r_all.status_code == 200
    cheque = next((m for m in r_all.json() if m["id"] == medio.id), None)
    assert cheque is not None
    assert cheque["activo"] is False

    # Verificar en el listado de solo activos (no debe aparecer)
    r_activos = client.get(
        f"{URL}?solo_activos=true", headers=headers(Rol.ADMINISTRADOR)
    )
    assert r_activos.status_code == 200
    assert not any(m["id"] == medio.id for m in r_activos.json())


def test_hu07b_ca2_modificacion_bloqueada_por_recargo_negativo(client, headers, db):
    """HU-07b CA2: No permite ingresar recargo negativo."""
    medio = MedioPago(
        nombre="Tarjeta Débito",
        tipo_acreditacion=TipoAcreditacion.INMEDIATA,
        porcentaje_recargo=Decimal("0.00"),
        activo=True,
    )
    db.add(medio)
    db.commit()

    payload = {
        "nombre": "Tarjeta Débito",
        "tipo_acreditacion": TipoAcreditacion.INMEDIATA.value,
        "porcentaje_recargo": "-5.00",
    }
    r = client.put(
        f"{URL}/{medio.id}", json=payload, headers=headers(Rol.ADMINISTRADOR)
    )
    assert r.status_code == 422


def test_hu07b_modificacion_exitosa(client, headers, db):
    """Modifica exitosamente nombre y recargo."""
    medio = MedioPago(
        nombre="Tarjeta Visa",
        tipo_acreditacion=TipoAcreditacion.DIFERIDA,
        porcentaje_recargo=Decimal("5.00"),
        activo=True,
    )
    db.add(medio)
    db.commit()

    payload = {
        "nombre": "Tarjeta Visa Crédito",
        "tipo_acreditacion": TipoAcreditacion.DIFERIDA.value,
        "porcentaje_recargo": "10.00",
    }
    r = client.put(
        f"{URL}/{medio.id}", json=payload, headers=headers(Rol.ADMINISTRADOR)
    )
    assert r.status_code == 200
    datos = r.json()
    assert datos["nombre"] == "Tarjeta Visa Crédito"
    assert Decimal(str(datos["porcentaje_recargo"])) == Decimal("10.00")


def test_hu07_permisos_mozo_bloqueado(client, headers, db):
    """Un mozo no tiene permisos para crear, modificar o eliminar medios de pago."""
    medio = MedioPago(
        nombre="Efectivo",
        tipo_acreditacion=TipoAcreditacion.INMEDIATA,
        porcentaje_recargo=Decimal("0.00"),
        activo=True,
    )
    db.add(medio)
    db.commit()

    # Intento crear como Mozo
    payload = {
        "nombre": "Bitcoin",
        "tipo_acreditacion": TipoAcreditacion.INMEDIATA.value,
        "porcentaje_recargo": "0.00",
    }
    r_post = client.post(URL, json=payload, headers=headers(Rol.MOZO))
    assert r_post.status_code == 403

    # Intento eliminar como Mozo
    r_del = client.delete(f"{URL}/{medio.id}", headers=headers(Rol.MOZO))
    assert r_del.status_code == 403
