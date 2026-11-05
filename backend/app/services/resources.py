import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Resource
from app.schemas.resources import ResourceIn, ResourceOut
from app.services.urls import normalize_url, source_name


def url_hash_or_422(url: str) -> str:
    try:
        return normalize_url(url)[1]
    except ValueError as e:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, str(e)) from e


async def upsert_resource(session: AsyncSession, data: ResourceIn, user_id: uuid.UUID | None) -> Resource:
    url_hash = url_hash_or_422(data.url)
    await session.execute(
        insert(Resource)
        .values(
            id=uuid.uuid4(),
            url=data.url.strip(),
            url_hash=url_hash,
            title=data.title.strip(),
            format=data.format,
            source=data.source.strip() or source_name(data.url),
            description=data.description,
            authors=data.authors,
            thumbnail=data.thumbnail,
            duration_minutes=data.duration_minutes,
            pages=data.pages,
            published_year=data.published_year,
            first_added_by=user_id,
        )
        .on_conflict_do_nothing(index_elements=[Resource.url_hash])
    )
    resource = await session.scalar(select(Resource).where(Resource.url_hash == url_hash))
    return resource


def resource_out(r: Resource) -> ResourceOut:
    return ResourceOut(
        url=r.url,
        url_hash=r.url_hash,
        title=r.title,
        format=r.format,
        source=r.source,
        description=r.description,
        authors=r.authors,
        thumbnail=r.thumbnail,
        duration_minutes=r.duration_minutes,
        pages=r.pages,
        difficulty=r.difficulty,
        published_year=r.published_year,
        avg_rating=float(r.avg_rating) if r.avg_rating is not None else None,
        review_count=r.review_count or None,
        origin=r.origin,
    )
