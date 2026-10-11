"""Recrea la base de desarrollo y carga los datos iniciales.

Uso: python -m app.seed

ATENCIÓN: borra todos los datos. Las contraseñas son solo para desarrollo.
Cada HU puede agregar sus datos de ejemplo en una función `seed_<modulo>(db)` y
llamarla desde `main()`.
"""

from app import models  # noqa: F401  (registra las tablas para create_all)
from app.core.database import Base, SessionLocal, engine
from app.core.enums import Rol
from app.core.security import hashear_password
from app.models.usuario import Usuario

USUARIOS = [
    ("admin", "Administrador", Rol.ADMINISTRADOR),
    ("mozo", "Mozo de prueba", Rol.MOZO),
]
PASSWORD_DESARROLLO = "1234"


def seed_usuarios(db) -> None:
    for username, nombre, rol in USUARIOS:
        db.add(
            Usuario(
                username=username,
                nombre=nombre,
                rol=rol,
                password_hash=hashear_password(PASSWORD_DESARROLLO),
            )
        )


def main() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_usuarios(db)
        db.commit()
    print("Base recreada. Usuarios: admin / mozo (contraseña: 1234)")


if __name__ == "__main__":
    main()
