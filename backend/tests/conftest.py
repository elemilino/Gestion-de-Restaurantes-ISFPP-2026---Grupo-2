"""Fixtures comunes para todas las pruebas.

- `db`: sesión sobre una base SQLite en memoria, nueva en cada test.
- `client`: TestClient de la app usando esa base.
- `token(rol)` / `headers(rol)`: crean un usuario con ese rol y devuelven su token
  o el header Authorization listo para usar.

Ejemplo:
    def test_hu04a_ca1_crea_plato(client, headers):
        r = client.post("/api/v1/carta/platos", json={...},
                        headers=headers(Rol.ADMINISTRADOR))
        assert r.status_code == 201
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401  (registra las tablas para create_all)
from app.core.database import Base, crear_engine, get_db
from app.core.enums import Rol
from app.core.security import crear_token, hashear_password
from app.main import create_app
from app.models.usuario import Usuario


@pytest.fixture
def db():
    engine = crear_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sesion = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    yield sesion
    sesion.close()
    engine.dispose()


@pytest.fixture
def app(db):
    aplicacion = create_app()
    aplicacion.dependency_overrides[get_db] = lambda: db
    return aplicacion


@pytest.fixture
def client(app):
    # Sin "with": no se ejecuta el lifespan, así no se crea restaurante.db.
    return TestClient(app)


@pytest.fixture
def crear_usuario(db):
    def _crear(username="admin", rol=Rol.ADMINISTRADOR, password="1234") -> Usuario:
        usuario = Usuario(
            username=username,
            nombre=username.capitalize(),
            rol=rol,
            password_hash=hashear_password(password),
        )
        db.add(usuario)
        db.commit()
        return usuario

    return _crear


@pytest.fixture
def token(db, crear_usuario):
    def _token(rol: Rol = Rol.ADMINISTRADOR) -> str:
        username = f"usuario_{rol.lower()}"
        usuario = db.scalars(
            select(Usuario).where(Usuario.username == username)
        ).first() or crear_usuario(username=username, rol=rol)
        return crear_token(usuario.id, usuario.rol)

    return _token


@pytest.fixture
def headers(token):
    def _headers(rol: Rol = Rol.ADMINISTRADOR) -> dict:
        return {"Authorization": f"Bearer {token(rol)}"}

    return _headers
