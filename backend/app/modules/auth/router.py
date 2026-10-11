"""Endpoints de autenticación (ejemplo del patrón router → service → repository)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.usuario import Usuario
from app.modules.auth.schemas import LoginIn, TokenOut, UsuarioOut
from app.modules.auth.service import AuthService

router = APIRouter()


@router.post("/login", response_model=TokenOut, summary="Iniciar sesión")
def login(datos: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    return AuthService(db).login(datos.username, datos.password)


@router.get("/me", response_model=UsuarioOut, summary="Usuario en sesión")
def me(usuario: Usuario = Depends(get_current_user)) -> Usuario:
    return usuario
