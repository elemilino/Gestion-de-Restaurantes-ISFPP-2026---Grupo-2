"""Recrea la base de desarrollo y carga los datos iniciales.

Uso: python -m app.seed

ATENCIÓN: borra todos los datos. Las contraseñas son solo para desarrollo.
Cada HU puede agregar sus datos de ejemplo en una función `seed_<modulo>(db)` y
llamarla desde `main()`.
"""

from datetime import datetime
from decimal import Decimal

from app import models  # noqa: F401  (registra las tablas para create_all)
from app.core.database import Base, SessionLocal, engine
from app.core.enums import Rol, TipoAcreditacion, TipoProducto
from app.core.security import hashear_password
from app.models.carta import Producto, SeccionCarta
from app.models.medios_pago import MedioPago
from app.models.personal import Mozo
from app.models.reservas import Reserva
from app.models.salon import Mesa, Sector
from app.models.usuario import Usuario

USUARIOS = [
    ("admin", "Administrador", Rol.ADMINISTRADOR),
    ("mozo", "Mozo de prueba", Rol.MOZO),
    ("cajero", "Cajero de prueba", Rol.CAJERO),
    ("recepcion", "Recepcionista de prueba", Rol.RECEPCIONISTA),
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


SECTORES = [
    ("Salón Principal", "Planta baja, junto a la barra"),
    ("Terraza", "Primer piso, al aire libre"),
    ("Patio", None),
]


def seed_salon(db) -> dict[str, Sector]:
    """Sectores y mesas de ejemplo (HU-01a, HU-01b)."""
    sectores = {}
    for nombre, descripcion in SECTORES:
        s = Sector(nombre=nombre, descripcion=descripcion, activo=True)
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

    # Reserva activa para hoy: la mesa 3 aparece Reservada, no se puede eliminar
    # ni bajar su capacidad a menos de 5 (HU-01b CA5 y CA7).
    hoy_21 = datetime.now().replace(hour=21, minute=0, second=0, microsecond=0)
    db.add(Reserva(fecha_hora=hoy_21, cantidad_comensales=5, mesas=[m3]))
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


SECCIONES_CARTA = [
    "Entradas",
    "Pastas",
    "Minutas",
    "Bien argentino",
    "Postres",
    "Cervezas",
    "Bebidas sin alcohol",
]


def seed_carta(db) -> None:
    """Secciones y productos de ejemplo de la carta (HU-03a, HU-04a a HU-04d)."""
    secciones = {}
    for orden, nombre in enumerate(SECCIONES_CARTA, start=1):
        seccion = SeccionCarta(nombre=nombre, orden=orden, activo=True)
        db.add(seccion)
        secciones[nombre] = seccion
    db.flush()

    def producto(tipo, nombre, precio, seccion, **datos) -> Producto:
        p = Producto(
            tipo=tipo,
            nombre=nombre,
            precio=Decimal(precio),
            seccion_id=secciones[seccion].id,
            **datos,
        )
        db.add(p)
        return p

    # HU-04a: platos
    producto(
        TipoProducto.PLATO,
        "Ñoquis con salsa",
        "5000",
        "Pastas",
        descripcion="Ñoquis de papa con salsa fileto",
        porcion_gramos=350,
    )
    producto(TipoProducto.PLATO, "Milanesa napolitana", "8500", "Minutas")
    producto(TipoProducto.PLATO, "Empanada de carne", "1200", "Entradas")
    bife = producto(
        TipoProducto.PLATO,
        "Bife de chorizo",
        "14000",
        "Bien argentino",
        porcion_gramos=400,
    )

    # HU-04b: postres
    flan = producto(TipoProducto.POSTRE, "Flan casero", "3000", "Postres")
    panqueque = producto(
        TipoProducto.POSTRE, "Panqueque con dulce de leche", "3500", "Postres"
    )

    # HU-04c: bebidas
    sin_alcohol = "Bebidas sin alcohol"
    bebida = TipoProducto.BEBIDA
    producto(
        bebida, "Cerveza tirada", "4000", "Cervezas", volumen_ml=500, alcoholica=True
    )
    producto(
        bebida, "Agua mineral", "1500", sin_alcohol, volumen_ml=500, alcoholica=False
    )
    producto(bebida, "Gaseosa", "1800", sin_alcohol, volumen_ml=350, alcoholica=False)
    producto(bebida, "Gaseosa", "3500", sin_alcohol, volumen_ml=1500, alcoholica=False)

    # HU-04d: stock y disponibilidad
    flan.stock = 10
    bife.stock = 0
    panqueque.disponible = False
    db.flush()


def seed_medios_pago(db) -> None:
    """Medios de pago de prueba (HU-07a)."""
    medios = [
        MedioPago(
            nombre="Efectivo",
            tipo_acreditacion=TipoAcreditacion.INMEDIATA,
            porcentaje_recargo=Decimal("0.00"),
            activo=True,
        ),
        MedioPago(
            nombre="MercadoPago",
            tipo_acreditacion=TipoAcreditacion.INMEDIATA,
            porcentaje_recargo=Decimal("0.00"),
            activo=True,
        ),
        MedioPago(
            nombre="Tarjeta Débito",
            tipo_acreditacion=TipoAcreditacion.INMEDIATA,
            porcentaje_recargo=Decimal("0.00"),
            activo=True,
        ),
        MedioPago(
            nombre="Tarjeta Visa Crédito",
            tipo_acreditacion=TipoAcreditacion.DIFERIDA,
            porcentaje_recargo=Decimal("10.00"),
            activo=True,
        ),
    ]
    db.add_all(medios)
    db.flush()


def main() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        usuarios = seed_usuarios(db)
        sectores = seed_salon(db)
        seed_mozos(db, usuarios["mozo"], sectores["Salón Principal"])
        seed_carta(db)
        seed_medios_pago(db)
        db.commit()
    print("Base recreada. Usuarios: admin / mozo / cajero (contraseña: 1234)")
    print("Sectores y mesas creados con mozo asignado a Salón Principal.")
    print("Reserva de ejemplo para hoy en la mesa 3.")
    print("Carta de ejemplo cargada.")
    print("Medios de pago cargados.")


if __name__ == "__main__":
    main()
