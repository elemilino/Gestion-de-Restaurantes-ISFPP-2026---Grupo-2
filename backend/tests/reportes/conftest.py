"""Fixtures de reportes: salón, mozos, productos, medios de pago y un armador
de ventas (comanda + factura + pagos) en una fecha dada."""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.core.enums import (
    EstadoComanda,
    EstadoFactura,
    Rol,
    TipoAcreditacion,
    TipoProducto,
)
from app.models.carta import Producto, SeccionCarta
from app.models.comandas import Comanda, DetalleComanda
from app.models.facturacion import DetallePago, Factura
from app.models.medios_pago import MedioPago
from app.models.personal import Mozo
from app.models.salon import Mesa, Sector


@pytest.fixture(autouse=True)
def sesion_encargado(client, headers):
    client.headers.update(headers(Rol.ENCARGADO_GENERAL))


def _hace(dias: int, hora: int = 21, minuto: int = 0) -> datetime:
    base = datetime.combine(date.today() - timedelta(days=dias), datetime.min.time())
    return base.replace(hour=hora, minute=minuto)


def _periodo(desde: int, hasta: int = 1) -> dict:
    return {
        "periodo": "PERSONALIZADO",
        "desde": (date.today() - timedelta(days=desde)).isoformat(),
        "hasta": (date.today() - timedelta(days=hasta)).isoformat(),
    }


@pytest.fixture
def hace():
    """hace(dias, hora=21, minuto=0): fecha y hora relativa a hoy."""
    return _hace


@pytest.fixture
def periodo():
    """periodo(desde, hasta=1): período personalizado en días hacia atrás."""
    return _periodo


@pytest.fixture
def base(db):
    salon = Sector(nombre="Salón")
    terraza = Sector(nombre="Terraza")
    db.add_all([salon, terraza])
    db.flush()
    mesas = {
        n: Mesa(numero=n, capacidad=4, sector_id=(salon if n <= 3 else terraza).id)
        for n in (1, 2, 3, 4)
    }
    minutas = SeccionCarta(nombre="Minutas", orden=1)
    cervezas = SeccionCarta(nombre="Cervezas", orden=2)
    db.add_all([*mesas.values(), minutas, cervezas])
    db.flush()
    datos = {
        "salon": salon,
        "terraza": terraza,
        "mesas": mesas,
        "minutas": minutas,
        "cervezas": cervezas,
        "ana": Mozo(dni="11111111", nombre="Ana", apellido="Ruiz", sector_id=salon.id),
        "beto": Mozo(dni="22222222", nombre="Beto", apellido="Paz", sector_id=salon.id),
        "milanesa": Producto(
            nombre="Milanesa",
            precio=Decimal("5000"),
            tipo=TipoProducto.PLATO,
            seccion_id=minutas.id,
        ),
        "flan": Producto(
            nombre="Flan",
            precio=Decimal("3000"),
            tipo=TipoProducto.POSTRE,
            seccion_id=minutas.id,
        ),
        "cerveza": Producto(
            nombre="Cerveza",
            precio=Decimal("4000"),
            tipo=TipoProducto.BEBIDA,
            seccion_id=cervezas.id,
            volumen_ml=500,
        ),
        "efectivo": MedioPago(
            nombre="Efectivo",
            tipo_acreditacion=TipoAcreditacion.INMEDIATA,
            porcentaje_recargo=Decimal("0"),
        ),
        "visa": MedioPago(
            nombre="Visa",
            tipo_acreditacion=TipoAcreditacion.DIFERIDA,
            porcentaje_recargo=Decimal("10"),
        ),
    }
    db.add_all(
        [v for v in datos.values() if isinstance(v, (Mozo, Producto, MedioPago))]
    )
    db.commit()
    return datos


@pytest.fixture
def venta(db, base):
    """Crea una comanda cerrada a la hora `cuando` y, si se indica, su factura.

    items: [(producto, cantidad, precio_unitario)]
    factura: EstadoFactura.PAGADA (default), ADEUDADA o None (sin facturar)
    pagos: [(medio, monto_abonado)]; por defecto, todo en efectivo si está pagada
    """

    def _venta(
        cuando: datetime,
        items=None,
        mozo=None,
        mesas=(1,),
        comensales=2,
        factura=EstadoFactura.PAGADA,
        pagos=None,
        estado=None,
        apertura=None,
    ) -> Comanda:
        items = items or [(base["milanesa"], 1, "5000")]
        if estado is None:
            estado = (
                EstadoComanda.FACTURADA
                if factura == EstadoFactura.PAGADA
                else EstadoComanda.CERRADA
            )
        comanda = Comanda(
            cantidad_comensales=comensales,
            mozo_id=(mozo or base["ana"]).id,
            mesas=[base["mesas"][n] for n in mesas],
            fecha_hora_apertura=apertura or cuando - timedelta(hours=1),
            fecha_hora_cierre=None if estado == EstadoComanda.ABIERTA else cuando,
            estado=estado,
            detalles=[
                DetalleComanda(
                    producto_id=p.id,
                    cantidad=c,
                    precio_unitario=Decimal(precio),
                    entregado=True,
                )
                for p, c, precio in items
            ],
        )
        db.add(comanda)
        db.flush()
        if factura is not None:
            importe = sum(Decimal(precio) * c for _, c, precio in items)
            f = Factura(
                comanda_id=comanda.id,
                fecha=cuando,
                importe_total=importe,
                total_a_pagar=importe,
                estado=factura,
            )
            if pagos is None and factura == EstadoFactura.PAGADA:
                pagos = [(base["efectivo"], importe)]
            for medio, abonado in pagos or []:
                abonado = Decimal(abonado)
                recargo = abonado * medio.porcentaje_recargo / 100
                f.detalles_pago.append(
                    DetallePago(
                        medio_pago_id=medio.id,
                        monto_abonado=abonado,
                        monto_con_recargo=abonado + recargo,
                    )
                )
            db.add(f)
        db.commit()
        return comanda

    return _venta
