"""Pruebas del módulo mozos (HU-02).

Cubre:
- CA1 (Asignación de sector en alta y modificación).
- CA2 (Restricción operativa por sector en mesas).
- CA3 (Baja con comandas activas y reasignación).
- Permisos por rol (solo administrador gestiona mozos).
"""

from app.core.enums import EstadoComanda, Rol
from app.models.comandas import Comanda
from app.models.personal import Mozo
from app.models.salon import Mesa, Sector

URL = "/api/v1/mozos"


def test_hu02_ca1_crea_mozo_con_sector_exitosamente(client, headers, db):
    """CA1: Da de alta un mozo con un sector asignado y crea su usuario."""
    sector = Sector(nombre="Terraza")
    db.add(sector)
    db.commit()

    payload = {
        "nombre": "Carlos",
        "apellido": "Gómez",
        "dni": "35123456",
        "telefono": "1144556677",
        "sector_id": sector.id,
        "username": "cgomez",
        "password": "password123",
    }
    r = client.post(URL, json=payload, headers=headers(Rol.ADMINISTRADOR))
    assert r.status_code == 201
    datos = r.json()
    assert datos["nombre"] == "Carlos"
    assert datos["apellido"] == "Gómez"
    assert datos["dni"] == "35123456"
    assert datos["sector_id"] == sector.id
    assert datos["sector_nombre"] == "Terraza"
    assert datos["username"] == "cgomez"
    assert datos["activo"] is True

    # Verificar que aparece en el listado
    r_list = client.get(URL, headers=headers(Rol.ADMINISTRADOR))
    assert r_list.status_code == 200
    assert any(m["dni"] == "35123456" for m in r_list.json())


def test_hu02_ca1_modifica_sector_de_mozo(client, headers, db):
    """CA1: Modifica el sector asignado a un mozo existente."""
    sector1 = Sector(nombre="Salón Principal")
    sector2 = Sector(nombre="Patio")
    db.add_all([sector1, sector2])
    db.commit()

    # Crear mozo
    r = client.post(
        URL,
        json={
            "nombre": "Laura",
            "apellido": "Pérez",
            "dni": "38999888",
            "sector_id": sector1.id,
            "username": "lperez",
            "password": "password123",
        },
        headers=headers(Rol.ADMINISTRADOR),
    )
    assert r.status_code == 201
    mozo_id = r.json()["id"]

    # Reasignar sector
    r_mod = client.put(
        f"{URL}/{mozo_id}",
        json={"sector_id": sector2.id, "telefono": "1199887766"},
        headers=headers(Rol.ADMINISTRADOR),
    )
    assert r_mod.status_code == 200
    datos = r_mod.json()
    assert datos["sector_id"] == sector2.id
    assert datos["sector_nombre"] == "Patio"
    assert datos["telefono"] == "1199887766"


def test_hu02_ca1_falla_si_sector_no_existe(client, headers):
    """CA1: Rechaza alta si el sector indicado no existe."""
    payload = {
        "nombre": "Esteban",
        "apellido": "Quito",
        "dni": "30111222",
        "sector_id": 9999,
        "username": "equito",
        "password": "password123",
    }
    r = client.post(URL, json=payload, headers=headers(Rol.ADMINISTRADOR))
    assert r.status_code == 404
    assert r.json()["code"] == "SECTOR_NO_ENCONTRADO"


def test_hu02_ca1_rechaza_dni_duplicado(client, headers, db):
    """CA1: Rechaza creación de mozo con DNI ya existente."""
    sector = Sector(nombre="Sector A")
    db.add(sector)
    db.commit()

    payload1 = {
        "nombre": "Ana",
        "apellido": "Ríos",
        "dni": "40123123",
        "sector_id": sector.id,
        "username": "arios",
        "password": "password123",
    }
    r1 = client.post(URL, json=payload1, headers=headers(Rol.ADMINISTRADOR))
    assert r1.status_code == 201

    payload2 = {
        "nombre": "Beatriz",
        "apellido": "Soto",
        "dni": "40123123",
        "sector_id": sector.id,
        "username": "bsoto",
        "password": "password123",
    }
    r2 = client.post(URL, json=payload2, headers=headers(Rol.ADMINISTRADOR))
    assert r2.status_code == 409
    assert r2.json()["code"] == "DNI_DUPLICADO"


def test_hu02_ca2_mozo_puede_operar_en_mesa_de_su_sector(client, db, crear_usuario):
    """CA2: Un mozo puede operar válidamente sobre una mesa de su sector."""
    from app.core.security import crear_token

    sector_terraza = Sector(nombre="Terraza")
    db.add(sector_terraza)
    db.flush()

    mesa = Mesa(numero=10, capacidad=4, sector_id=sector_terraza.id)
    db.add(mesa)
    db.flush()

    usuario_mozo = crear_usuario(username="mozo_terraza", rol=Rol.MOZO)
    mozo = Mozo(
        dni="33445566",
        nombre="Mozo",
        apellido="Terraza",
        sector_id=sector_terraza.id,
        usuario_id=usuario_mozo.id,
        activo=True,
    )
    db.add(mozo)
    db.commit()

    token_mozo = crear_token(usuario_mozo.id, usuario_mozo.rol)
    h = {"Authorization": f"Bearer {token_mozo}"}

    r = client.post(f"{URL}/validar-mesa/{mesa.id}", headers=h)
    assert r.status_code == 200
    assert r.json()["permitido"] is True
    assert r.json()["sector_id"] == sector_terraza.id


def test_hu02_ca2_mozo_rechazado_al_operar_en_mesa_de_otro_sector(
    client, db, crear_usuario
):
    """CA2: Rechaza operación si la mesa pertenece a un sector distinto al del mozo."""
    from app.core.security import crear_token

    sector_terraza = Sector(nombre="Terraza")
    sector_patio = Sector(nombre="Patio")
    db.add_all([sector_terraza, sector_patio])
    db.flush()

    mesa_patio = Mesa(numero=20, capacidad=2, sector_id=sector_patio.id)
    db.add(mesa_patio)
    db.flush()

    usuario_mozo = crear_usuario(username="mozo_solo_terraza", rol=Rol.MOZO)
    mozo = Mozo(
        dni="33778899",
        nombre="Mozo",
        apellido="Exclusivo",
        sector_id=sector_terraza.id,
        usuario_id=usuario_mozo.id,
        activo=True,
    )
    db.add(mozo)
    db.commit()

    token_mozo = crear_token(usuario_mozo.id, usuario_mozo.rol)
    h = {"Authorization": f"Bearer {token_mozo}"}

    r = client.post(f"{URL}/validar-mesa/{mesa_patio.id}", headers=h)
    assert r.status_code == 422
    assert r.json()["code"] == "MESA_FUERA_DE_SECTOR"


def test_hu02_ca2_admin_puede_operar_en_cualquier_mesa(client, headers, db):
    """CA2: El Administrador tiene habilitado el acceso a cualquier mesa."""
    sector = Sector(nombre="Salón Principal")
    db.add(sector)
    db.flush()
    mesa = Mesa(numero=5, capacidad=4, sector_id=sector.id)
    db.add(mesa)
    db.commit()

    r = client.post(f"{URL}/validar-mesa/{mesa.id}", headers=headers(Rol.ADMINISTRADOR))
    assert r.status_code == 200
    assert r.json()["permitido"] is True


def test_hu02_ca3_rechaza_baja_si_mozo_tiene_comandas_abiertas(
    client, headers, db, crear_usuario
):
    """CA3: Exige que no tenga comandas activas (ABIERTA) antes de dar de baja."""
    sector = Sector(nombre="Salón Central")
    db.add(sector)
    db.flush()
    mesa = Mesa(numero=1, capacidad=4, sector_id=sector.id)
    db.add(mesa)
    db.flush()

    usuario_mozo = crear_usuario(username="mozo_con_comandas", rol=Rol.MOZO)
    mozo = Mozo(
        dni="31222333",
        nombre="Mario",
        apellido="Bros",
        sector_id=sector.id,
        usuario_id=usuario_mozo.id,
        activo=True,
    )
    db.add(mozo)
    db.flush()

    # Comanda activa
    comanda = Comanda(mesa_id=mesa.id, mozo_id=mozo.id, estado=EstadoComanda.ABIERTA)
    db.add(comanda)
    db.commit()

    # Intento de baja
    r = client.delete(f"{URL}/{mozo.id}", headers=headers(Rol.ADMINISTRADOR))
    assert r.status_code == 409
    assert r.json()["code"] == "MOZO_CON_COMANDAS_ACTIVAS"


def test_hu02_ca3_permite_baja_luego_de_cerrar_o_reasignar_comandas(
    client, headers, db, crear_usuario
):
    """CA3: Permite la baja tras reasignar las comandas activas a otro mozo."""
    sector = Sector(nombre="Salón")
    db.add(sector)
    db.flush()
    mesa = Mesa(numero=2, capacidad=4, sector_id=sector.id)
    db.add(mesa)
    db.flush()

    u1 = crear_usuario(username="mozo1", rol=Rol.MOZO)
    u2 = crear_usuario(username="mozo2", rol=Rol.MOZO)
    m1 = Mozo(
        dni="31111111",
        nombre="Mozo",
        apellido="Uno",
        sector_id=sector.id,
        usuario_id=u1.id,
        activo=True,
    )
    m2 = Mozo(
        dni="32222222",
        nombre="Mozo",
        apellido="Dos",
        sector_id=sector.id,
        usuario_id=u2.id,
        activo=True,
    )
    db.add_all([m1, m2])
    db.flush()

    comanda = Comanda(mesa_id=mesa.id, mozo_id=m1.id, estado=EstadoComanda.ABIERTA)
    db.add(comanda)
    db.commit()

    # Reasignar comandas de m1 a m2
    r_reasignar = client.post(
        f"{URL}/{m1.id}/reasignar-comandas",
        json={"nuevo_mozo_id": m2.id},
        headers=headers(Rol.ADMINISTRADOR),
    )
    assert r_reasignar.status_code == 200
    assert r_reasignar.json()["comandas_reasignadas"] == 1

    # Ahora la baja de m1 debe ser exitosa
    r_baja = client.delete(f"{URL}/{m1.id}", headers=headers(Rol.ADMINISTRADOR))
    assert r_baja.status_code == 204

    # Verificar que m1 ya no figura activo
    r_get = client.get(f"{URL}/{m1.id}", headers=headers(Rol.ADMINISTRADOR))
    assert r_get.status_code == 404


def test_hu02_mozo_no_puede_gestionar_mozos(client, headers):
    """Seguridad: Un usuario con rol MOZO no puede crear ni eliminar mozos (403)."""
    h_mozo = headers(Rol.MOZO)
    r_list = client.get(URL, headers=h_mozo)
    assert r_list.status_code == 403

    r_post = client.post(
        URL,
        json={
            "nombre": "Test",
            "apellido": "Mozo",
            "dni": "20333444",
            "username": "tmozo",
            "password": "123",
        },
        headers=h_mozo,
    )
    assert r_post.status_code == 403
