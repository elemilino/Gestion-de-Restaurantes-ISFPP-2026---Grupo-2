"""Errores de dominio y su conversión a respuestas HTTP.

Los services lanzan estas excepciones; el handler las convierte siempre al mismo
formato: {"detail": "<mensaje para el usuario>", "code": "<CODIGO>"}.

Ejemplo en un service:
    raise ConflictError("Ya existe una sección con ese nombre", "SECCION_DUPLICADA")
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class DomainError(Exception):
    status_code = 400
    default_code = "ERROR"

    def __init__(self, detail: str, code: str | None = None):
        super().__init__(detail)
        self.detail = detail
        self.code = code or self.default_code


class NotFoundError(DomainError):
    """El recurso pedido no existe (o está dado de baja)."""

    status_code = 404
    default_code = "NO_ENCONTRADO"


class ConflictError(DomainError):
    """Duplicados o eliminaciones bloqueadas por el estado de otros datos."""

    status_code = 409
    default_code = "CONFLICTO"


class BusinessRuleError(DomainError):
    """La operación viola una regla de negocio de la HU."""

    status_code = 422
    default_code = "REGLA_DE_NEGOCIO"


def registrar_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain_error(_request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "code": exc.code},
        )
