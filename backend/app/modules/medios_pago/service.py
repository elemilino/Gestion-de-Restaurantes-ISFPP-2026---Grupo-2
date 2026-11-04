"""Reglas de negocio del módulo medios_pago (HU-07a, HU-07b)."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.medios_pago import MedioPago
from app.modules.medios_pago.repository import MedioPagoRepository
from app.modules.medios_pago.schemas import (
    MedioPagoCreate,
    MedioPagoOut,
    MedioPagoUpdate,
)


class MedioPagoService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MedioPagoRepository(db)

    def listar(self, solo_activos: bool = False) -> list[MedioPagoOut]:
        medios = self.repo.listar(solo_activos=solo_activos)
        return [MedioPagoOut.model_validate(m) for m in medios]

    def obtener(self, medio_id: int) -> MedioPagoOut:
        medio = self._obtener_entidad(medio_id)
        return MedioPagoOut.model_validate(medio)

    def crear(self, datos: MedioPagoCreate) -> MedioPagoOut:
        # CA2 (Modificación/Creación bloqueada por recargo negativo)
        if datos.porcentaje_recargo < Decimal("0.00"):
            raise BusinessRuleError(
                "El recargo no puede ser un valor negativo",
                code="RECARGO_NEGATIVO",
            )

        # CA2 (Creación bloqueada por nombre duplicado)
        if self.repo.buscar_por_nombre(datos.nombre):
            raise ConflictError(
                "El medio de pago ya se encuentra registrado",
                code="MEDIO_PAGO_DUPLICADO",
            )

        medio = MedioPago(
            nombre=datos.nombre.strip(),
            tipo_acreditacion=datos.tipo_acreditacion,
            porcentaje_recargo=datos.porcentaje_recargo,
            activo=True,
        )
        self.db.add(medio)
        self.db.commit()
        self.db.refresh(medio)
        return MedioPagoOut.model_validate(medio)

    def modificar(self, medio_id: int, datos: MedioPagoUpdate) -> MedioPagoOut:
        medio = self._obtener_entidad(medio_id)

        # HU-07b CA2: porcentaje_recargo no puede ser negativo
        if datos.porcentaje_recargo < Decimal("0.00"):
            raise BusinessRuleError(
                "El recargo no puede ser un valor negativo",
                code="RECARGO_NEGATIVO",
            )

        # Validar si el nombre colisiona con otro medio de pago
        if self.repo.buscar_por_nombre(datos.nombre, excluir_id=medio.id):
            raise ConflictError(
                "El medio de pago ya se encuentra registrado",
                code="MEDIO_PAGO_DUPLICADO",
            )

        medio.nombre = datos.nombre.strip()
        medio.tipo_acreditacion = datos.tipo_acreditacion
        medio.porcentaje_recargo = datos.porcentaje_recargo
        if datos.activo is not None:
            medio.activo = datos.activo

        self.db.commit()
        self.db.refresh(medio)
        return MedioPagoOut.model_validate(medio)

    def eliminar(self, medio_id: int) -> None:
        """HU-07b CA1: Baja lógica del medio de pago."""
        medio = self._obtener_entidad(medio_id)
        medio.activo = False
        self.db.commit()

    def _obtener_entidad(self, medio_id: int) -> MedioPago:
        medio = self.repo.buscar_por_id(medio_id)
        if not medio:
            raise NotFoundError(
                "El medio de pago no existe",
                code="MEDIO_PAGO_NO_ENCONTRADO",
            )
        return medio

