from collections.abc import AsyncIterator
from functools import lru_cache
from sqlalchemy import Engine, create_engine
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import get_settings


@lru_cache
def get_async_engine() -> AsyncEngine:
    return create_async_engine(get_settings().sqlalchemy_url, pool_pre_ping=True)


@lru_cache
def get_sync_engine() -> Engine:
    return create_engine(get_settings().sqlalchemy_url, pool_pre_ping=True)


async def get_session() -> AsyncIterator[AsyncSession]:
    sessions = async_sessionmaker(get_async_engine(), expire_on_commit=False)
    async with sessions() as session:
        yield session
