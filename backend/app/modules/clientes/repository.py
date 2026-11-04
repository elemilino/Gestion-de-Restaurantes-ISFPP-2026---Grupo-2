"""Acceso a datos del módulo clientes: solo consultas."""

import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.clientes import Cliente


def _normalizar(texto: str) -> str:
    """Minúsculas y sin tildes, para buscar nombres en español."""
    descompuesto = unicodedata.normalize("NFD", texto.casefold())
    return "".join(c for c in descompuesto if not unicodedata.combining(c))


class ClienteRepository:
    def __init__(self, db: Session):
        self.db = db

    def listar_activos(self, busqueda: str | None = None) -> list[Cliente]:
        consulta = select(Cliente).where(Cliente.activo)
        clientes = list(self.db.scalars(consulta))
        if busqueda:
            clientes = [c for c in clientes if self._coincide(c, busqueda)]
        return sorted(
            clientes,
            key=lambda c: (_normalizar(c.apellido), _normalizar(c.nombre)),
        )

    def buscar_activo_por_id(self, cliente_id: int) -> Cliente | None:
        cliente = self.db.get(Cliente, cliente_id)
        return cliente if cliente is not None and cliente.activo else None

    def buscar_activo_por_dni(
        self, dni: str, excluir_id: int | None = None
    ) -> Cliente | None:
        consulta = select(Cliente).where(Cliente.activo, Cliente.dni == dni)
        if excluir_id is not None:
            consulta = consulta.where(Cliente.id != excluir_id)
        return self.db.scalars(consulta).first()

    @staticmethod
    def _coincide(cliente: Cliente, busqueda: str) -> bool:
        """CA7: busca por DNI, nombre, apellido o nombre completo."""
        texto = _normalizar(busqueda)
        nombre = _normalizar(cliente.nombre)
        apellido = _normalizar(cliente.apellido)
        nombre_completo = f"{nombre} {apellido}"
        return (
            texto in nombre
            or texto in apellido
            or texto in nombre_completo
            or texto in cliente.dni
        )
