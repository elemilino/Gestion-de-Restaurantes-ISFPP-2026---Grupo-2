from fastapi import Depends

from app.core.deps import require_roles
from app.core.enums import Rol
from app.core.exceptions import ConflictError


def test_login_correcto_devuelve_token_y_usuario(client, crear_usuario):
    crear_usuario(username="admin", password="1234")
    r = client.post(
        "/api/v1/auth/login", json={"username": "admin", "password": "1234"}
    )
    assert r.status_code == 200
    datos = r.json()
    assert datos["access_token"]
    assert datos["usuario"]["rol"] == "ADMINISTRADOR"


def test_login_incorrecto_devuelve_error_con_formato_comun(client, crear_usuario):
    crear_usuario(username="admin", password="1234")
    r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "x"})
    assert r.status_code == 422
    assert r.json() == {
        "detail": "Usuario o contraseña incorrectos",
        "code": "CREDENCIALES_INVALIDAS",
    }


def test_me_devuelve_el_usuario_en_sesion(client, headers):
    r = client.get("/api/v1/auth/me", headers=headers(Rol.MOZO))
    assert r.status_code == 200
    assert r.json()["rol"] == "MOZO"


def test_me_sin_token_devuelve_401(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_require_roles_bloquea_otros_roles(app, client, headers):
    @app.get(
        "/prueba/solo-admin", dependencies=[Depends(require_roles(Rol.ADMINISTRADOR))]
    )
    def solo_admin():
        return {"ok": True}

    assert (
        client.get("/prueba/solo-admin", headers=headers(Rol.MOZO)).status_code == 403
    )
    assert (
        client.get("/prueba/solo-admin", headers=headers(Rol.ADMINISTRADOR)).status_code
        == 200
    )


def test_errores_de_dominio_usan_status_y_formato_comun(app, client):
    @app.get("/prueba/conflicto")
    def conflicto():
        raise ConflictError("Ya existe una sección con ese nombre", "SECCION_DUPLICADA")

    r = client.get("/prueba/conflicto")
    assert r.status_code == 409
    assert r.json()["code"] == "SECCION_DUPLICADA"
