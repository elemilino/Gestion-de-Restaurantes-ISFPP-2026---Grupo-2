"""Fixtures de reservas (HU-11a y HU-11b): salón, cliente, medio de pago y plato."""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.core.enums import EstadoReserva, Rol, TipoAcreditacion, TipoProducto
from app.models.carta import Producto, SeccionCarta
from app.models.clientes import Cliente
from app.models.medios_pago import MedioPago
from app.models.reservas import Reserva, Sena
from app.models.salon import Mesa, Sector

URL = "/api/v1/reservas"


@pytest.fixture(autouse=True)
def sesion_recepcionista(client, headers):
    client.headers.update(headers(Rol.RECEPCIONISTA))


@pytest.fixture
def salon(db) -> dict[int, Mesa]:
    """Mesas 1 (4 lugares), 2 (2 lugares) y 3 (6 lugares) en el mismo sector."""
    sector = Sector(nombre="Salón")
    db.add(sector)
    db.flush()
    mesas = {
        n: Mesa(numero=n, capacidad=c, sector_id=sector.id)
        for n, c in ((1, 4), (2, 2), (3, 6))
    }
    db.add_all(mesas.values())
    db.commit()
    return mesas


@pytest.fixture
def cliente(db) -> Cliente:
    c = Cliente(nombre="Laura", apellido="Gómez", telefono="2804111111", dni="30111222")
    db.add(c)
    db.commit()
    return c


@pytest.fixture
def medio_pago(db) -> MedioPago:
    m = MedioPago(
        nombre="Efectivo",
        tipo_acreditacion=TipoAcreditacion.INMEDIATA,
        porcentaje_recargo=Decimal("0"),
        activo=True,
    )
    db.add(m)
    db.commit()
    return m


@pytest.fixture
def plato(db) -> Producto:
    seccion = SeccionCarta(nombre="Pastas", orden=1)
    db.add(seccion)
    db.flush()
    p = Producto(
        nombre="Ñoquis",
        precio=Decimal("5000"),
        tipo=TipoProducto.PLATO,
        seccion_id=seccion.id,
    )
    db.add(p)
    db.commit()
    return p


def manana() -> date:
    return date.today() + timedelta(days=1)


@pytest.fixture
def datos(salon, cliente, medio_pago):
    """Payload válido: mañana 21:00, 2 horas, 4 comensales en la mesa 1."""

    def _datos(**cambios) -> dict:
        base = {
            "fecha": manana().isoformat(),
            "hora": "21:00",
            "duracion_horas": 2,
            "cantidad_comensales": 4,
            "numeros_mesa": [1],
            "cliente_id": cliente.id,
            "sena": {"monto": "10000", "medio_pago_id": medio_pago.id},
            "menu_acordado": [],
        }
        base.update(cambios)
        return base

    return _datos


@pytest.fixture
def reserva_en(db, salon, cliente, medio_pago):
    """Reserva ACTIVA en la mesa 1 a una hora relativa a ahora (para HU-11b)."""

    def _crear(
        desde_ahora: timedelta, estado: EstadoReserva = EstadoReserva.ACTIVA
    ) -> Reserva:
        reserva = Reserva(
            fecha_hora=datetime.now() + desde_ahora,
            duracion_horas=2,
            cantidad_comensales=2,
            cliente_id=cliente.id,
            estado=estado,
            mesas=[salon[1]],
            sena=Sena(monto=Decimal("5000"), medio_pago_id=medio_pago.id),
        )
        db.add(reserva)
        db.commit()
        return reserva

    return _crear
