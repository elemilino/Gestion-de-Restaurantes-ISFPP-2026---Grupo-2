"""Acceso a datos del módulo auth: solo consultas, sin reglas de negocio."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.usuario import Usuario


class UsuarioRepository:
    def __init__(self, db: Session):
        self.db = db

    def buscar_por_username(self, username: str) -> Usuario | None:
        consulta = select(Usuario).where(Usuario.username == username)
        return self.db.scalars(consulta).first()
