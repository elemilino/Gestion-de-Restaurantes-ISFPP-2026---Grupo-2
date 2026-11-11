"""Reglas de negocio del módulo clientes (HU-10)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import EstadoReserva
from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.clientes import Cliente
from app.models.reservas import Reserva
from app.modules.clientes.repository import ClienteRepository
from app.modules.clientes.schemas import ClienteCreate, ClienteOut, ClienteUpdate

CAMPOS_OBLIGATORIOS = {"nombre", "apellido", "telefono", "dni"}


class ClienteService:
    def __init__(self, db: Session):
        self.db = db
        self.clientes = ClienteRepository(db)

    def listar(self, busqueda: str | None = None) -> list[ClienteOut]:
        """CA7: lista clientes activos y filtra por DNI, nombre o apellido."""
        texto = busqueda.strip() if busqueda else None
        return [
            ClienteOut.model_validate(cliente)
            for cliente in self.clientes.listar_activos(texto)
        ]

    def obtener(self, cliente_id: int) -> ClienteOut:
        """CA7: devuelve los datos de un cliente activo."""
        return ClienteOut.model_validate(self._obtener(cliente_id))

    def crear(self, datos: ClienteCreate) -> ClienteOut:
        """CA1 a CA3: registra un cliente activo con DNI único entre activos."""
        if self.clientes.buscar_activo_por_dni(datos.dni):
            raise ConflictError(
                "Ya existe un cliente asociado a ese DNI",
                "CLIENTE_DNI_DUPLICADO",
            )

        cliente = Cliente(**datos.model_dump(), activo=True)
        self.db.add(cliente)
        self.db.commit()
        self.db.refresh(cliente)
        return ClienteOut.model_validate(cliente)

    def modificar(self, cliente_id: int, datos: ClienteUpdate) -> ClienteOut:
        """CA4: actualiza solo los datos enviados, validando el DNI si cambia."""
        cliente = self._obtener(cliente_id)
        cambios = datos.model_dump(exclude_unset=True)

        if "dni" in cambios:
            dni = cambios["dni"]
            if dni is None:
                raise BusinessRuleError("El DNI es obligatorio", "CAMPO_OBLIGATORIO")
            if dni != cliente.dni and self.clientes.buscar_activo_por_dni(
                dni, excluir_id=cliente.id
            ):
                raise ConflictError(
                    "Ya existe un cliente asociado a ese DNI",
                    "CLIENTE_DNI_DUPLICADO",
                )

        for campo, valor in cambios.items():
            if campo in CAMPOS_OBLIGATORIOS and valor is None:
                raise BusinessRuleError(
                    f"El campo {campo} es obligatorio", "CAMPO_OBLIGATORIO"
                )
            setattr(cliente, campo, valor)

        self.db.commit()
        self.db.refresh(cliente)
        return ClienteOut.model_validate(cliente)

    def eliminar(self, cliente_id: int) -> None:
        """CA5: baja lógica del cliente. CA6: no si tiene reservas activas."""
        cliente = self._obtener(cliente_id)
        activas = self.db.scalar(
            select(func.count(Reserva.id)).where(
                Reserva.cliente_id == cliente.id,
                Reserva.estado == EstadoReserva.ACTIVA,
            )
        )
        if activas:
            raise ConflictError(
                "No se puede eliminar el cliente: posee reservas asociadas",
                "CLIENTE_CON_RESERVAS",
            )
        cliente.activo = False
        self.db.commit()

    def _obtener(self, cliente_id: int) -> Cliente:
        cliente = self.clientes.buscar_activo_por_id(cliente_id)
        if cliente is None:
            raise NotFoundError("Cliente no encontrado", "CLIENTE_NO_ENCONTRADO")
        return cliente
