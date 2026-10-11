"""Conexión a SQLite con SQLAlchemy.

- `Base`: clase base de todos los modelos (`app/models/`).
- `get_db()`: dependencia de FastAPI que abre una sesión por request.
- Cada conexión activa WAL (mejor concurrencia de escritura, RNF) y las claves
  foráneas (SQLite no las controla si no se activan).
"""

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def crear_engine(url: str, **opciones):
    engine = create_engine(url, connect_args={"check_same_thread": False}, **opciones)

    @event.listens_for(engine, "connect")
    def _pragmas_sqlite(conexion, _registro):
        cursor = conexion.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


engine = crear_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
