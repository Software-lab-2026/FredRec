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
    youtube_api_key: str = ""
    core_api_key: str = ""
    github_token: str = ""
    google_books_api_key: str = ""
    semantic_scholar_api_key: str = ""
    openalex_api_key: str = ""
    contact_email: str = ""
    search_demo: bool = False
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    topic_match_threshold: float = 0.72
    resource_match_threshold: float = 0.72
    suggestion_threshold: float = 0.68
    scraped_match_threshold: float = 0.75
    scrape_delay_seconds: float = 1.0

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
