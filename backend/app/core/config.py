"""Configuración de la aplicación, leída desde variables de entorno o `.env`."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./restaurante.db"
    jwt_secret: str = "cambiar-esta-clave-en-cada-maquina"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
