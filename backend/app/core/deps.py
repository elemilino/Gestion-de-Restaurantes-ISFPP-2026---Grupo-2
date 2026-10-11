"""Dependencias comunes para los routers.

Uso en un endpoint:
    @router.post("", dependencies=[Depends(require_roles(Rol.ADMINISTRADOR))])
    def crear(...): ...

o, si se necesita el usuario:
    def listar(usuario: Usuario = Depends(get_current_user)): ...
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.enums import Rol
from app.core.security import leer_token
from app.models.usuario import Usuario

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credenciales: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    no_autenticado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesión inválida o vencida",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credenciales is None:
        raise no_autenticado
    try:
        datos = leer_token(credenciales.credentials)
    except jwt.InvalidTokenError:
        raise no_autenticado
    usuario = db.get(Usuario, int(datos["sub"]))
    if usuario is None or not usuario.activo:
        raise no_autenticado
    return usuario


def require_roles(*roles: Rol):
    """Permite el acceso solo a usuarios con alguno de los roles indicados."""

    def _verificar(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if usuario.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés permisos para realizar esta acción",
            )
        return usuario

    return _verificar
