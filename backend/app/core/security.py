"""Hash de contraseñas (bcrypt) y tokens JWT."""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


def hashear_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verificar_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def crear_token(usuario_id: int, rol: str) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    datos = {"sub": str(usuario_id), "rol": rol, "exp": expira}
    return jwt.encode(datos, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def leer_token(token: str) -> dict:
    """Devuelve el contenido del token o lanza `jwt.InvalidTokenError`."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
