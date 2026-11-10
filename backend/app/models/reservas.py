"""Reserva, Seña y Menú acordado (HU-11a y HU-11b).

- Una reserva ocupa una o varias mesas (N:M con `reserva_mesa`) durante
  `duracion_horas` desde `fecha_hora`.
- Estados (diagrama de clases): ACTIVA → CUMPLIDA (llegó el cliente),
  CANCELADA (cancelación anticipada) o AUSENTE (no llegó en la tolerancia).
- La seña es obligatoria al crearla (HU-11a CA6) y se paga con un medio de pago.
- El menú acordado es opcional: platos con su cantidad y precio acordado.

`cliente_id` acepta vacío solo por las reservas mínimas que crean las pruebas de
HU-01b; el service de HU-11a siempre exige un cliente activo.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Column, Enum, ForeignKey, Numeric, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import EstadoReserva
from app.models.carta import Producto
from app.models.clientes import Cliente
from app.models.medios_pago import MedioPago
from app.models.salon import Mesa

if TYPE_CHECKING:
    from app.models.comandas import Comanda

reserva_mesa = Table(
    "reserva_mesa",
    Base.metadata,
    Column("reserva_id", ForeignKey("reserva.id"), primary_key=True),
    Column("mesa_id", ForeignKey("mesa.id"), primary_key=True),
)


class Reserva(Base):
    __tablename__ = "reserva"

    id: Mapped[int] = mapped_column(primary_key=True)  # nro_reserva
    fecha_hora: Mapped[datetime]
    duracion_horas: Mapped[int] = mapped_column(default=2)
    cantidad_comensales: Mapped[int]
    estado: Mapped[EstadoReserva] = mapped_column(
        Enum(EstadoReserva, native_enum=False, length=20),
        default=EstadoReserva.ACTIVA,
    )
    cliente_id: Mapped[int | None] = mapped_column(
        ForeignKey("cliente.id"), default=None
    )
    # HU-11b: hora de llegada del cliente (automática al registrarla).
    fecha_hora_llegada: Mapped[datetime | None] = mapped_column(default=None)

    cliente: Mapped[Cliente | None] = relationship()
    mesas: Mapped[list[Mesa]] = relationship(secondary=reserva_mesa)
    sena: Mapped["Sena | None"] = relationship(
        back_populates="reserva", uselist=False, cascade="all, delete-orphan"
    )
    menu_acordado: Mapped["MenuAcordado | None"] = relationship(
        back_populates="reserva", uselist=False, cascade="all, delete-orphan"
    )
    # HU-05a CA8: la comanda que se abre a partir de la reserva cumplida.
    comanda: Mapped["Comanda | None"] = relationship(
        back_populates="reserva", uselist=False
    )

    @property
    def fecha_hora_fin(self) -> datetime:
        return self.fecha_hora + timedelta(hours=self.duracion_horas)


class Sena(Base):
    """Seña de una reserva (diagrama: monto, fecha, activo, devuelta)."""

    __tablename__ = "sena"

    id: Mapped[int] = mapped_column(primary_key=True)
    reserva_id: Mapped[int] = mapped_column(ForeignKey("reserva.id"), unique=True)
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    fecha: Mapped[datetime] = mapped_column(default=datetime.now)
    medio_pago_id: Mapped[int] = mapped_column(ForeignKey("medio_pago.id"))
    activo: Mapped[bool] = mapped_column(default=True)
    # HU-11a CA10: se devuelve si la reserva se cancela a tiempo.
    devuelta: Mapped[bool] = mapped_column(default=False)

    reserva: Mapped[Reserva] = relationship(back_populates="sena")
    medio_pago: Mapped[MedioPago] = relationship()


class MenuAcordado(Base):
    """Menú acordado de una reserva (diagrama: nro_menu)."""

    __tablename__ = "menu_acordado"

    id: Mapped[int] = mapped_column(primary_key=True)  # nro_menu
    reserva_id: Mapped[int] = mapped_column(ForeignKey("reserva.id"), unique=True)

    reserva: Mapped[Reserva] = relationship(back_populates="menu_acordado")
    detalles: Mapped[list["DetalleMenuAcordado"]] = relationship(
        back_populates="menu", cascade="all, delete-orphan"
    )


class DetalleMenuAcordado(Base):
    """Plato del menú acordado con su cantidad y precio acordado."""

    __tablename__ = "detalle_menu_acordado"

    id: Mapped[int] = mapped_column(primary_key=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("menu_acordado.id"))
    producto_id: Mapped[int] = mapped_column(ForeignKey("producto.id"))
    cantidad: Mapped[int]
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    menu: Mapped[MenuAcordado] = relationship(back_populates="detalles")
    producto: Mapped[Producto] = relationship()
