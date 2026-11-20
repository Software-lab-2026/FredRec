from sqlalchemy import func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.connectors.base import Candidate
from app.core.config import get_settings
from app.models import ScrapedItem
from app.schemas.resources import ResourceOut

PER_SOURCE = 6
_DOCUMENT = func.to_tsvector("english", ScrapedItem.search_text)


def _out(item: ScrapedItem) -> ResourceOut:
    return ResourceOut(
        url=item.url,
        url_hash=item.url_hash,
        title=item.title,
        format=item.format,
        source=item.source,
        description=item.description,
        authors=item.authors,
        thumbnail=item.thumbnail,
        duration_minutes=item.duration_minutes,
        published_year=item.published_year,
    )


async def scraped_candidates(
    session: AsyncSession, query: str, looked_up: str, vector: list[float] | None
) -> list[Candidate]:
    phrases = list(dict.fromkeys(p.strip()
                   for p in (query, looked_up) if p and p.strip()))
    if not phrases:
        return []
    word_match = or_(
        *(_DOCUMENT.op("@@")(func.plainto_tsquery("english", p)) for p in phrases))
    if vector is not None:
        similarity = 1 - ScrapedItem.embedding.cosine_distance(vector)
        close = similarity >= get_settings().scraped_match_threshold
        condition = or_(word_match, close)
        score = func.coalesce(similarity, 0)
    else:
        condition, score = word_match, literal(0.0)
    words = func.ts_rank(
        _DOCUMENT, func.plainto_tsquery("english", phrases[0]))
    rows = (
        await session.execute(
            select(ScrapedItem)
            .where(condition)
            .order_by(score.desc(), words.desc(), ScrapedItem.title)
            .limit(PER_SOURCE * 8)
        )
    ).scalars()

    per_source: dict[str, list[Candidate]] = {}
    for item in rows:
        picked = per_source.setdefault(item.source, [])
        if len(picked) < PER_SOURCE:
            picked.append(
                Candidate(_out(item), popularity=None, position=len(picked)))
    return [c for picked in per_source.values() for c in picked]
