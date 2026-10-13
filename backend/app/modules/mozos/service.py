"""Reglas de negocio del módulo mozos (HU-02). Lanza errores de dominio."""

from sqlalchemy.orm import Session

from app.core.enums import Rol
from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.core.security import hashear_password
from app.models.personal import Mozo
from app.models.usuario import Usuario
from app.modules.mozos.repository import MozoRepository
from app.modules.mozos.schemas import (
    MozoCreate,
    MozoOut,
    MozoUpdate,
    ReasignarComandasOut,
    SectorSimpleOut,
    ValidarMesaResponse,
)


class MozoService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = MozoRepository(db)

    def listar(self) -> list[MozoOut]:
        """Lista todos los mozos activos."""
        mozos = self.repository.listar_activos()
        return [MozoOut.from_entity(m) for m in mozos]

    def listar_sectores(self) -> list[SectorSimpleOut]:
        """Lista todos los sectores activos para asignación."""
        sectores = self.repository.listar_sectores_activos()
        return [SectorSimpleOut.model_validate(s) for s in sectores]

    def obtener_por_id(self, mozo_id: int) -> MozoOut:
        """Obtiene un mozo activo por su id."""
        mozo = self.repository.buscar_activo_por_id(mozo_id)
        if mozo is None:
            raise NotFoundError("Mozo no encontrado", "MOZO_NO_ENCONTRADO")
        return MozoOut.from_entity(mozo)

    def crear(self, datos: MozoCreate) -> MozoOut:
        """HU-02 CA1: Da de alta un mozo, su usuario de login y le asigna un sector."""
        if self.repository.buscar_activo_por_dni(datos.dni):
            raise ConflictError("Ya existe un mozo activo con ese DNI", "DNI_DUPLICADO")

        if self.repository.buscar_usuario_por_username(datos.username):
            raise ConflictError(
                "Ya existe un usuario con ese nombre de usuario",
                "USUARIO_DUPLICADO",
            )

        if datos.sector_id is not None:
            sector = self.repository.buscar_sector_activo(datos.sector_id)
            if sector is None:
                raise NotFoundError(
                    "El sector asignado no existe o está inactivo",
                    "SECTOR_NO_ENCONTRADO",
                )

        usuario = Usuario(
            username=datos.username,
            nombre=f"{datos.nombre} {datos.apellido}",
            rol=Rol.MOZO,
            password_hash=hashear_password(datos.password),
            activo=True,
        )
        self.db.add(usuario)
        self.db.flush()

        mozo = Mozo(
            dni=datos.dni,
            nombre=datos.nombre,
            apellido=datos.apellido,
            telefono=datos.telefono,
            sector_id=datos.sector_id,
            usuario_id=usuario.id,
            activo=True,
        )
        self.db.add(mozo)
        self.db.commit()
        self.db.refresh(mozo)
        return MozoOut.from_entity(mozo)

    def modificar(self, mozo_id: int, datos: MozoUpdate) -> MozoOut:
        """HU-02 CA1: Modifica datos de un mozo y/o reasigna su sector."""
        mozo = self.repository.buscar_activo_por_id(mozo_id)
        if mozo is None:
            raise NotFoundError("Mozo no encontrado", "MOZO_NO_ENCONTRADO")

        if datos.sector_id is not None:
            sector = self.repository.buscar_sector_activo(datos.sector_id)
            if sector is None:
                raise NotFoundError(
                    "El sector asignado no existe o está inactivo",
                    "SECTOR_NO_ENCONTRADO",
                )
            mozo.sector_id = datos.sector_id

        if datos.nombre is not None:
            mozo.nombre = datos.nombre
        if datos.apellido is not None:
            mozo.apellido = datos.apellido
        if datos.telefono is not None:
            mozo.telefono = datos.telefono

        if (datos.nombre is not None or datos.apellido is not None) and mozo.usuario:
            mozo.usuario.nombre = f"{mozo.nombre} {mozo.apellido}"

        self.db.commit()
        self.db.refresh(mozo)
        return MozoOut.from_entity(mozo)

    def eliminar(self, mozo_id: int) -> None:
        """HU-02 CA3: Baja lógica. Exige que no tenga comandas activas."""
        mozo = self.repository.buscar_activo_por_id(mozo_id)
        if mozo is None:
            raise NotFoundError("Mozo no encontrado", "MOZO_NO_ENCONTRADO")

        comandas_activas = self.repository.contar_comandas_activas(mozo_id)
        if comandas_activas > 0:
            msg = (
                f"No se puede dar de baja al mozo: tiene {comandas_activas} "
                "comanda(s) activas asociadas. Debe reasignarlas, cerrarlas "
                "o cancelarlas antes de inhabilitarlo."
            )
            raise ConflictError(msg, "MOZO_CON_COMANDAS_ACTIVAS")

        mozo.activo = False
        if mozo.usuario:
            mozo.usuario.activo = False

        self.db.commit()

    def reasignar_comandas(
        self, mozo_origen_id: int, nuevo_mozo_id: int
    ) -> ReasignarComandasOut:
        """HU-02 CA3: Permite reasignar comandas activas de un mozo a otro."""
        if mozo_origen_id == nuevo_mozo_id:
            raise BusinessRuleError(
                "El mozo de destino debe ser diferente al actual",
                "MOZO_DESTINO_INVALIDO",
            )

        mozo_origen = self.repository.buscar_por_id(mozo_origen_id)
        if mozo_origen is None:
            raise NotFoundError("Mozo de origen no encontrado", "MOZO_NO_ENCONTRADO")

        nuevo_mozo = self.repository.buscar_activo_por_id(nuevo_mozo_id)
        if nuevo_mozo is None:
            raise NotFoundError(
                "El mozo de destino no existe o está inactivo",
                "MOZO_DESTINO_NO_ENCONTRADO",
            )

        comandas = self.repository.buscar_comandas_activas(mozo_origen_id)
        for comanda in comandas:
            comanda.mozo_id = nuevo_mozo_id

        self.db.commit()
        msg = (
            f"Se reasignaron {len(comandas)} comanda(s) a "
            f"{nuevo_mozo.nombre} {nuevo_mozo.apellido}"
        )
        return ReasignarComandasOut(
            comandas_reasignadas=len(comandas),
            mensaje=msg,
        )

    def validar_operacion_mesa(
        self, usuario: Usuario, mesa_id: int
    ) -> ValidarMesaResponse:
        """HU-02 CA2: Valida que la mesa pertenezca al sector asignado."""
        mesa = self.repository.buscar_mesa_activa(mesa_id)
        if mesa is None:
            raise NotFoundError("Mesa no encontrada o inactiva", "MESA_NO_ENCONTRADA")

        # Administrador tiene acceso irrestricto
        if usuario.rol == Rol.ADMINISTRADOR:
            return ValidarMesaResponse(
                permitido=True,
                mensaje="Acceso total habilitado para rol Administrador",
                mesa_id=mesa.id,
                sector_id=mesa.sector_id,
                sector_nombre=mesa.sector.nombre if mesa.sector else None,
            )

        mozo = self.repository.buscar_por_usuario_id(usuario.id)
        if mozo is None or mozo.sector_id is None:
            raise BusinessRuleError(
                "El mozo no tiene un sector de salón asignado para operar mesas",
                "MOZO_SIN_SECTOR",
            )

        if mesa.sector_id != mozo.sector_id:
            sector_mesa = mesa.sector.nombre if mesa.sector else "desconocido"
            sector_mozo = mozo.sector.nombre if mozo.sector else "desconocido"
            raise BusinessRuleError(
                f"Operación no permitida: la mesa pertenece al sector '{sector_mesa}' "
                f"y el mozo está asignado al sector '{sector_mozo}'.",
                "MESA_FUERA_DE_SECTOR",
            )

        return ValidarMesaResponse(
            permitido=True,
            mensaje="Mesa habilitada para el sector asignado al mozo",
            mesa_id=mesa.id,
            sector_id=mesa.sector_id,
            sector_nombre=mesa.sector.nombre if mesa.sector else None,
        )

    def obtener_mi_perfil(self, usuario: Usuario) -> MozoOut:
        """Devuelve el perfil del mozo asociado al usuario en sesión."""
        mozo = self.repository.buscar_por_usuario_id(usuario.id)
        if mozo is None:
            raise NotFoundError(
                "No se encontró un perfil de mozo para este usuario",
                "MOZO_NO_ENCONTRADO",
            )
        return MozoOut.from_entity(mozo)
