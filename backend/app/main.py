"""Punto de entrada del backend: `uvicorn app.main:app --reload`."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (registra las tablas para create_all)
from app.api import api_router
from app.core.config import settings
from app.core.database import Base, engine
from app.core.exceptions import registrar_handlers


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Restaurante - ISFPP 2026",
        description="API del sistema de gestión del restaurante (IS3, Grupo 2).",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    registrar_handlers(app)
    app.include_router(api_router)

    @app.get("/api/health", tags=["Sistema"], summary="Estado del servicio")
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
