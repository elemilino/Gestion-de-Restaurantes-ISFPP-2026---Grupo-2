"""Recrea la base de desarrollo y carga los datos iniciales.

Uso: python -m app.seed

ATENCIÓN: borra todos los datos. Las contraseñas son solo para desarrollo.
Cada HU puede agregar sus datos de ejemplo en una función `seed_<modulo>(db)` y
llamarla desde `main()`.
"""

import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

from app import models  # noqa: F401  (registra las tablas para create_all)
from app.core.database import Base, SessionLocal, engine
from app.core.enums import (
    EstadoComanda,
    EstadoFactura,
    EstadoReserva,
    Rol,
    TipoAcreditacion,
    TipoProducto,
)
from app.core.security import hashear_password
from app.models.carta import Producto, SeccionCarta
from app.models.clientes import Cliente
from app.models.comandas import Comanda, DetalleComanda
from app.models.facturacion import DetallePago, Factura
from app.models.medios_pago import MedioPago
from app.models.personal import Mozo
from app.models.promociones import Promocion
from app.models.reservas import DetalleMenuAcordado, MenuAcordado, Reserva, Sena
from app.models.salon import Mesa, Sector
from app.models.usuario import Usuario

USUARIOS = [
    ("admin", "Administrador", Rol.ADMINISTRADOR),
    ("mozo", "Mozo de prueba", Rol.MOZO),
    ("cajero", "Cajero de prueba", Rol.CAJERO),
    ("recepcion", "Recepcionista de prueba", Rol.RECEPCIONISTA),
    ("encargado", "Encargado general de prueba", Rol.ENCARGADO_GENERAL),
    ("cocinero", "Cocinero de prueba", Rol.COCINERO),
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
    "Menús",
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
    milanesa = producto(TipoProducto.PLATO, "Milanesa napolitana", "8500", "Minutas")
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

    # HU-09b: menús especiales vigentes esta semana
    hoy = date.today()
    producto(
        TipoProducto.MENU_EJECUTIVO,
        "Ejecutivo milanesa y flan",
        "10500",
        "Menús",
        plato_id=milanesa.id,
        postre_id=flan.id,
        fecha_inicio=hoy,
        fecha_fin=hoy + timedelta(days=6),
    )
    producto(
        TipoProducto.MENU_DEL_DIA,
        "Menú del día: bife",
        "12000",
        "Menús",
        plato_id=bife.id,
        fecha_inicio=hoy,
        fecha_fin=hoy,
    )
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


CLIENTES = [
    ("Laura", "Gómez", "2804111111", "30111222", "laura.gomez@example.com"),
    ("Martín", "Díaz", "2804222222", "28333444", None),
    ("Sofía", "Herrera", "2804333333", "35555666", "sofia.h@example.com"),
]


def seed_clientes_y_reservas(db) -> None:
    """Clientes (HU-10) y reservas con seña y menú acordado (HU-11a/b)."""
    clientes = []
    for nombre, apellido, telefono, dni, email in CLIENTES:
        c = Cliente(
            nombre=nombre, apellido=apellido, telefono=telefono, dni=dni, email=email
        )
        db.add(c)
        clientes.append(c)
    db.flush()
    mesas = {m.numero: m for m in db.scalars(select(Mesa))}
    efectivo = db.scalars(select(MedioPago).where(MedioPago.nombre == "Efectivo")).one()
    mp = db.scalars(select(MedioPago).where(MedioPago.nombre == "MercadoPago")).one()
    noquis = db.scalars(
        select(Producto).where(Producto.nombre == "Ñoquis con salsa")
    ).one()

    hoy = datetime.now().replace(minute=0, second=0, microsecond=0)
    hoy_21 = hoy.replace(hour=21)

    def reserva(cliente, cuando, comensales, numeros, medio, monto, **extra):
        r = Reserva(
            fecha_hora=cuando,
            cantidad_comensales=comensales,
            cliente_id=cliente.id,
            mesas=[mesas[n] for n in numeros],
            sena=Sena(monto=Decimal(monto), medio_pago_id=medio.id),
            **extra,
        )
        db.add(r)
        return r

    # Activa para hoy: la mesa 3 aparece Reservada, no se puede eliminar ni
    # bajar su capacidad a menos de 5 (HU-01b CA5 y CA7).
    reserva(clientes[0], hoy_21, 5, [3], efectivo, "15000")
    # Activa para mañana, con menú acordado (HU-11a CA7).
    manana = reserva(clientes[1], hoy_21 + timedelta(days=1), 4, [1], mp, "10000")
    manana.menu_acordado = MenuAcordado(
        detalles=[
            DetalleMenuAcordado(
                producto_id=noquis.id, cantidad=4, precio=Decimal("4500")
            )
        ]
    )
    # Historial para HU-12e: cumplida, ausente y cancelada.
    hace = timedelta(days=3)
    reserva(
        clientes[0],
        hoy_21 - hace,
        2,
        [2],
        efectivo,
        "5000",
        estado=EstadoReserva.CUMPLIDA,
        fecha_hora_llegada=hoy_21 - hace,
    )
    reserva(
        clientes[2], hoy_21 - hace, 4, [4], mp, "8000", estado=EstadoReserva.AUSENTE
    )
    cancelada = reserva(
        clientes[1],
        hoy_21 - timedelta(days=5),
        2,
        [2],
        efectivo,
        "5000",
        estado=EstadoReserva.CANCELADA,
    )
    cancelada.sena.devuelta = True
    db.flush()


def seed_historial(db) -> None:
    """Comandas cerradas y facturas de las últimas 3 semanas, para los reportes
    (HU-12a a HU-12f). Se generan con una semilla fija: siempre son las mismas."""
    azar = random.Random(2026)
    mozo = db.scalars(select(Mozo)).first()
    mesas = list(db.scalars(select(Mesa).where(Mesa.activo)))
    productos = list(
        db.scalars(
            select(Producto).where(
                Producto.activo,
                Producto.tipo.in_(
                    [TipoProducto.PLATO, TipoProducto.POSTRE, TipoProducto.BEBIDA]
                ),
            )
        )
    )
    medios = list(db.scalars(select(MedioPago).where(MedioPago.activo)))
    hoy = datetime.now().replace(minute=0, second=0, microsecond=0)
    for dias in range(21, 0, -1):
        for _ in range(azar.randint(2, 6)):
            apertura = (hoy - timedelta(days=dias)).replace(
                hour=azar.choice([12, 13, 13, 20, 21, 21, 22]),
                minute=azar.choice([0, 15, 30, 45]),
            )
            cierre = apertura + timedelta(minutes=azar.randint(50, 130))
            elegidos = azar.sample(productos, azar.randint(1, 3))
            detalles = [
                DetalleComanda(
                    producto_id=p.id,
                    cantidad=azar.randint(1, 3),
                    precio_unitario=p.precio,
                    entregado=True,
                )
                for p in elegidos
            ]
            sorteo = azar.random()
            if sorteo < 0.08:  # anulada: el cliente se fue sin pedir (HU-06 CA3)
                estado, detalles = EstadoComanda.ANULADA, []
            elif sorteo < 0.18:  # facturada pero todavía adeudada
                estado = EstadoComanda.CERRADA
            else:
                estado = EstadoComanda.FACTURADA
            comanda = Comanda(
                cantidad_comensales=azar.randint(1, 4),
                mozo_id=mozo.id,
                mesas=[azar.choice(mesas)],
                fecha_hora_apertura=apertura,
                fecha_hora_cierre=cierre,
                estado=estado,
                motivo_anulacion=(
                    "El cliente se retiró sin pedir"
                    if estado == EstadoComanda.ANULADA
                    else None
                ),
                detalles=detalles,
            )
            db.add(comanda)
            db.flush()
            if estado == EstadoComanda.ANULADA:
                continue
            importe = sum(d.precio_unitario * d.cantidad for d in detalles)
            factura = Factura(
                comanda_id=comanda.id,
                fecha=cierre,
                importe_total=importe,
                total_a_pagar=importe,
                estado=(
                    EstadoFactura.PAGADA
                    if estado == EstadoComanda.FACTURADA
                    else EstadoFactura.ADEUDADA
                ),
            )
            if estado == EstadoComanda.FACTURADA:
                medio = azar.choice(medios)
                recargo = importe * medio.porcentaje_recargo / 100
                factura.total_a_pagar = importe + recargo
                factura.monto_recibido = importe + recargo
                factura.detalles_pago = [
                    DetallePago(
                        medio_pago_id=medio.id,
                        monto_abonado=importe,
                        monto_con_recargo=importe + recargo,
                    )
                ]
            db.add(factura)
    db.flush()


def seed_promociones(db) -> None:
    """Promociones de ejemplo (HU-09a).

    Una vigente, una programada y una vencida (inactiva). Los productos se
    buscan por nombre para no depender del orden de creación del seed de carta.
    """
    productos = {p.nombre: p for p in db.scalars(select(Producto))}
    hoy = date.today()

    db.add_all(
        [
            Promocion(
                descripcion="Martes de pastas",
                fecha_inicio=hoy,
                fecha_fin=hoy + timedelta(days=30),
                descuento=Decimal("15.00"),
                activo=True,
                productos=[
                    productos["Ñoquis con salsa"],
                    productos["Milanesa napolitana"],
                ],
            ),
            Promocion(
                descripcion="Happy hour de postres",
                fecha_inicio=hoy + timedelta(days=7),
                fecha_fin=hoy + timedelta(days=14),
                descuento=Decimal("20.00"),
                activo=True,
                productos=[productos["Flan casero"]],
            ),
            Promocion(
                descripcion="Promo de lanzamiento (vencida)",
                fecha_inicio=hoy - timedelta(days=30),
                fecha_fin=hoy - timedelta(days=10),
                descuento=Decimal("10.00"),
                activo=False,
                productos=[productos["Agua mineral"]],
            ),
        ]
    )
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
        seed_clientes_y_reservas(db)
        seed_promociones(db)
        seed_historial(db)
        db.commit()
    print(
        "Base recreada. Usuarios: admin / mozo / cajero / recepcion / encargado / "
        "cocinero (contraseña: 1234)"
    )
    print("Sectores y mesas creados con mozo asignado a Salón Principal.")
    print("Clientes y reservas de ejemplo (hoy en la mesa 3, mañana en la mesa 1).")
    print("Carta de ejemplo cargada.")
    print("Medios de pago cargados.")
    print("Promociones de ejemplo cargadas.")
    print("Historial de comandas y facturas de las últimas 3 semanas (reportes).")


if __name__ == "__main__":
    main()
