"""Reglas de negocio del módulo promociones (HU-09a)."""

from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.carta import Producto
from app.models.promociones import Promocion
from app.modules.promociones.repository import PromocionRepository
from app.modules.promociones.schemas import (
    PromocionCreate,
    PromocionOut,
    PromocionUpdate,
)

CAMPOS_OBLIGATORIOS = ("descripcion", "descuento", "fecha_inicio", "fecha_fin")


class PromocionService:
    def __init__(self, db: Session):
        self.db = db
        self.promociones = PromocionRepository(db)

    # --- Consultas ---

    def listar(self, estado: str | None = None) -> list[PromocionOut]:
        """Lista promociones; antes desactiva las vencidas (CA5)."""
        self._desactivar_expiradas()
        hoy = date.today()
        promociones = self.promociones.listar()
        if estado and estado != "todas":
            promociones = [
                p for p in promociones if self._coincide_estado(p, estado, hoy)
            ]
        return [PromocionOut.model_validate(p) for p in promociones]

    def obtener(self, promocion_id: int) -> PromocionOut:
        """Devuelve una promoción, esté activa o no, para conservar el historial."""
        self._desactivar_expiradas()
        return PromocionOut.model_validate(self._obtener(promocion_id))

    # --- Altas y modificaciones ---

    def crear(self, datos: PromocionCreate) -> PromocionOut:
        """CA1 a CA3: registra una promoción activa vinculada a sus productos."""
        self._desactivar_expiradas()
        self._validar_fechas(datos.fecha_inicio, datos.fecha_fin)
        productos = self._validar_productos(datos.productos_ids)
        self._validar_superposicion(productos, datos.fecha_inicio, datos.fecha_fin)

        promocion = Promocion(
            descripcion=datos.descripcion,
            fecha_inicio=datos.fecha_inicio,
            fecha_fin=datos.fecha_fin,
            descuento=datos.descuento,
            activo=True,
            productos=productos,
        )
        self.db.add(promocion)
        self.db.commit()
        self.db.refresh(promocion)
        return PromocionOut.model_validate(promocion)

    def modificar(self, promocion_id: int, datos: PromocionUpdate) -> PromocionOut:
        """CA4: actualiza solo los datos enviados y recalcula la vigencia."""
        self._desactivar_expiradas()
        promocion = self._obtener(promocion_id)
        cambios = datos.model_dump(exclude_unset=True)

        for campo in CAMPOS_OBLIGATORIOS:
            if campo in cambios and cambios[campo] is None:
                raise BusinessRuleError(
                    f"El campo {campo} es obligatorio", "CAMPO_OBLIGATORIO"
                )

        fecha_inicio = cambios.get("fecha_inicio", promocion.fecha_inicio)
        fecha_fin = cambios.get("fecha_fin", promocion.fecha_fin)
        inicio_cambio = (
            "fecha_inicio" in cambios and fecha_inicio != promocion.fecha_inicio
        )
        self._validar_fechas(
            fecha_inicio,
            fecha_fin,
            permitir_inicio_pasado=not inicio_cambio,
        )

        if "productos_ids" in cambios:
            productos = self._validar_productos(cambios["productos_ids"])
        else:
            productos = list(promocion.productos)

        # Solo una promoción activa puede generar superposiciones.
        if promocion.activo:
            self._validar_superposicion(
                productos, fecha_inicio, fecha_fin, excluir_id=promocion.id
            )

        for campo in CAMPOS_OBLIGATORIOS:
            if campo in cambios:
                setattr(promocion, campo, cambios[campo])
        if "productos_ids" in cambios:
            promocion.productos = productos

        self.db.commit()
        self.db.refresh(promocion)
        return PromocionOut.model_validate(promocion)

    # --- Estado y baja lógica ---

    def cambiar_estado(self, promocion_id: int, activo: bool) -> PromocionOut:
        """CA5: activa o desactiva una promoción sin borrar su historial."""
        self._desactivar_expiradas()
        promocion = self._obtener(promocion_id)
        if activo:
            self._validar_activable(promocion)
        promocion.activo = activo
        self.db.commit()
        self.db.refresh(promocion)
        return PromocionOut.model_validate(promocion)

    def eliminar(self, promocion_id: int) -> None:
        """CA5: baja lógica. La promoción deja de aplicarse, pero no se borra."""
        self._desactivar_expiradas()
        promocion = self._obtener(promocion_id)
        promocion.activo = False
        self.db.commit()

    # --- Validaciones ---

    def _obtener(self, promocion_id: int) -> Promocion:
        promocion = self.promociones.buscar_por_id(promocion_id)
        if promocion is None:
            raise NotFoundError("Promoción no encontrada", "PROMOCION_NO_ENCONTRADA")
        return promocion

    def _desactivar_expiradas(self) -> None:
        if self.promociones.desactivar_expiradas(date.today()):
            self.db.commit()

    @staticmethod
    def _validar_fechas(
        fecha_inicio: date,
        fecha_fin: date,
        permitir_inicio_pasado: bool = False,
    ) -> None:
        if fecha_fin <= fecha_inicio:
            raise BusinessRuleError(
                "La fecha de fin debe ser posterior a la fecha de inicio",
                "PROMOCION_FECHAS_INVALIDAS",
            )
        if fecha_inicio < date.today() and not permitir_inicio_pasado:
            raise BusinessRuleError(
                "La fecha de inicio no puede ser anterior a hoy",
                "PROMOCION_FECHAS_INVALIDAS",
            )

    def _validar_productos(self, productos_ids: list[int] | None) -> list[Producto]:
        """CA2: al menos un producto, sin repetidos, existente y activo."""
        if not productos_ids:
            raise BusinessRuleError(
                "Tenés que seleccionar al menos un producto",
                "PROMOCION_SIN_PRODUCTOS",
            )

        ids_unicos = list(dict.fromkeys(productos_ids))
        encontrados = {p.id: p for p in self.promociones.buscar_productos(ids_unicos)}
        if any(pid not in encontrados for pid in ids_unicos):
            raise BusinessRuleError(
                "Uno o más productos no existen", "PRODUCTO_NO_ENCONTRADO"
            )

        productos = [encontrados[pid] for pid in ids_unicos]
        inactivos = [p.nombre for p in productos if not p.activo]
        if inactivos:
            raise BusinessRuleError(
                "Producto inactivo: " + ", ".join(inactivos), "PRODUCTO_INACTIVO"
            )
        return productos

    def _validar_superposicion(
        self,
        productos: list[Producto],
        fecha_inicio: date,
        fecha_fin: date,
        excluir_id: int | None = None,
    ) -> None:
        """Evita dos promociones activas para el mismo producto en el mismo rango."""
        if not productos:
            return
        superpuesta = self.promociones.buscar_superpuesta(
            [p.id for p in productos], fecha_inicio, fecha_fin, excluir_id
        )
        if superpuesta is not None:
            raise ConflictError(
                "Ya existe una promoción activa para uno de esos productos "
                "en ese período",
                "PROMOCION_SUPERPUESTA",
            )

    def _validar_activable(self, promocion: Promocion) -> None:
        if promocion.fecha_fin < date.today():
            raise BusinessRuleError(
                "No se puede activar una promoción vencida",
                "PROMOCION_YA_VENCIDA",
            )
        self._validar_superposicion(
            list(promocion.productos),
            promocion.fecha_inicio,
            promocion.fecha_fin,
            excluir_id=promocion.id,
        )

    @staticmethod
    def _coincide_estado(promocion: Promocion, estado: str, hoy: date) -> bool:
        if estado == "vigentes":
            return promocion.vigente
        if estado == "programadas":
            return promocion.activo and promocion.fecha_inicio > hoy
        if estado == "vencidas":
            return promocion.fecha_fin < hoy
        if estado == "inactivas":
            return not promocion.activo and promocion.fecha_fin >= hoy
        return True
