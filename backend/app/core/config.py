import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PLACEHOLDER_HOST = "@HOST/"
MIN_JWT_SECRET_LENGTH = 32


class MissingDatabaseUrl(RuntimeError):
    pass


class MissingJwtSecret(RuntimeError):
    pass


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.environ.get("FREDREC_ENV_FILE", BACKEND_DIR / ".env"), extra="ignore"
    )

    database_url: str = ""
    jwt_secret: str = ""

    @property
    def jwt_key(self) -> str:
        if len(self.jwt_secret) < MIN_JWT_SECRET_LENGTH:
            raise MissingJwtSecret(
                "JWT Token is not set."
            )
        return self.jwt_secret

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url.strip()
        if not url or PLACEHOLDER_HOST in url:
            raise MissingDatabaseUrl(
                "Database URL is not set."
            )
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
