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
from app.models.personal import Mozo
from app.models.salon import Mesa, Sector
from app.models.usuario import Usuario

USUARIOS = [
    ("admin", "Administrador", Rol.ADMINISTRADOR),
    ("mozo", "Mozo de prueba", Rol.MOZO),
]
PASSWORD_DESARROLLO = "1234"


def seed_usuarios(db) -> dict[str, Usuario]:
    usuarios = {}
    for username, nombre, rol in USUARIOS:
        u = Usuario(
            username=username,
            nombre=nombre,
            rol=rol,
            password_hash=hashear_password(PASSWORD_DESARROLLO),
        )
        db.add(u)
        usuarios[username] = u
    db.flush()
    return usuarios


def seed_salon(db) -> dict[str, Sector]:
    sectores = {}
    for nombre in ["Salón Principal", "Terraza", "Patio"]:
        s = Sector(nombre=nombre, activo=True)
        db.add(s)
        sectores[nombre] = s
    db.flush()

    # Mesas de prueba vinculadas a sectores
    m1 = Mesa(
        numero=1, capacidad=4, sector_id=sectores["Salón Principal"].id, activo=True
    )
    m2 = Mesa(
        numero=2, capacidad=2, sector_id=sectores["Salón Principal"].id, activo=True
    )
    m3 = Mesa(numero=3, capacidad=6, sector_id=sectores["Terraza"].id, activo=True)
    m4 = Mesa(numero=4, capacidad=4, sector_id=sectores["Patio"].id, activo=True)
    db.add_all([m1, m2, m3, m4])
    db.flush()
    return sectores


def seed_mozos(db, usuario_mozo: Usuario, sector_salon: Sector) -> None:
    mozo = Mozo(
        dni="12345678",
        nombre="Mozo",
        apellido="De Prueba",
        telefono="1122334455",
        sector_id=sector_salon.id,
        usuario_id=usuario_mozo.id,
        activo=True,
    )
    db.add(mozo)


def main() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        usuarios = seed_usuarios(db)
        sectores = seed_salon(db)
        seed_mozos(db, usuarios["mozo"], sectores["Salón Principal"])
        db.commit()
    print("Base recreada. Usuarios: admin / mozo (contraseña: 1234)")
    print("Sectores y mesas creados con mozo asignado a Salón Principal.")


if __name__ == "__main__":
    main()
