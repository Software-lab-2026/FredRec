from datetime import UTC, datetime, timedelta
from typing import Any
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import SearchCache


async def get_many(session: AsyncSession, keys: list[str]) -> dict[str, Any]:
    if not keys:
        return {}
    rows = await session.execute(
        select(SearchCache.key, SearchCache.value).where(
            SearchCache.key.in_(
                keys), SearchCache.expires_at > datetime.now(UTC)
        )
    )
    return dict(rows.all())


async def put(session: AsyncSession, key: str, value: Any, hours: int) -> None:
    expires = datetime.now(UTC) + timedelta(hours=hours)
    await session.execute(
        insert(SearchCache)
        .values(key=key, value=value, expires_at=expires)
        .on_conflict_do_update(index_elements=[SearchCache.key], set_={"value": value, "expires_at": expires})
    )
