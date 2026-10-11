"""Reglas de negocio del módulo auth. No conoce HTTP: lanza errores de dominio."""

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError
from app.core.security import crear_token, verificar_password
from app.modules.auth.repository import UsuarioRepository
from app.modules.auth.schemas import TokenOut, UsuarioOut


class AuthService:
    def __init__(self, db: Session):
        self.usuarios = UsuarioRepository(db)

    def login(self, username: str, password: str) -> TokenOut:
        """Valida las credenciales y devuelve un token JWT con el rol del usuario."""
        usuario = self.usuarios.buscar_por_username(username)
        if (
            usuario is None
            or not usuario.activo
            or not verificar_password(password, usuario.password_hash)
        ):
            raise BusinessRuleError(
                "Usuario o contraseña incorrectos", "CREDENCIALES_INVALIDAS"
            )
        return TokenOut(
            access_token=crear_token(usuario.id, usuario.rol),
            usuario=UsuarioOut.model_validate(usuario),
        )
