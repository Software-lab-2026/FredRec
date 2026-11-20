import asyncio
import logging
import httpx
from fastapi import HTTPException, status
from sqlalchemy import select, true
from sqlalchemy.ext.asyncio import AsyncSession
from app.connectors import CONNECTORS, Candidate, Connector
from app.core.config import Settings, get_settings
from app.core.embeddings import embed_query
from app.models import Resource, SearchEvent
from app.models.base import MatchKind, ResourceFormat, ResourceOrigin, ResourceStatus
from app.schemas.resources import ResourceOut
from app.schemas.search import MatchOut, SearchOut
from app.services import search_cache
from app.services.demo_source import demo_results
from app.services.matching import Match, match_query, match_path
from app.services.ranking import rank
from app.services.scraped_search import scraped_candidates
from app.services.resources import resource_out

log = logging.getLogger(__name__)

SOURCE_TIMEOUT_SECONDS = 6
RESULTS_PER_SOURCE = 6


def source_query(topic: str) -> str:
    return f"{topic} programming" if len(topic) <= 2 else topic


def _cache_key(connector: Connector, query: str) -> str:
    return f"src:{connector.name}:{query.lower()}"


async def fetch_from_sources(
    session: AsyncSession, topic: str, settings: Settings
) -> tuple[list[Candidate], list[str], bool]:
    query = source_query(topic)
    connectors = [c for c in CONNECTORS if c.enabled(settings)]
    cached = await search_cache.get_many(session, [_cache_key(c, query) for c in connectors])
    missing = [c for c in connectors if _cache_key(c, query) not in cached]

    async def ask(client: httpx.AsyncClient, connector: Connector) -> list[Candidate]:
        return await asyncio.wait_for(
            connector.search(client, query, RESULTS_PER_SOURCE,
                             settings), SOURCE_TIMEOUT_SECONDS
        )

    fresh: dict[str, list[Candidate]] = {}
    failed: list[str] = []
    if missing:
        agent = "FredRec/0.1 (free CS learning resources)" + \
            (f"; {settings.contact_email}" if settings.contact_email else "")
        async with httpx.AsyncClient(headers={"User-Agent": agent}, follow_redirects=True) as client:
            answers = await asyncio.gather(*(ask(client, c) for c in missing), return_exceptions=True)
        for connector, answer in zip(missing, answers, strict=True):
            if isinstance(answer, BaseException):
                log.warning("Search source %s failed: %r",
                            connector.name, answer)
                failed.append(connector.name)
            else:
                fresh[connector.name] = answer
        for connector in missing:
            if connector.name in fresh:
                value = [c.to_json() for c in fresh[connector.name]]
                await search_cache.put(session, _cache_key(connector, query), value, connector.cache_hours)
        await session.commit()

    results = [Candidate.from_json(c)
               for value in cached.values() for c in value]
    results += [c for answer in fresh.values() for c in answer]
    return results, failed, not missing


async def related_resources(
    session: AsyncSession, vector: list[float] | None, exclude: set[str], limit: int = 6
) -> list[ResourceOut]:
    if vector is None:
        return []
    distance = Resource.embedding.cosine_distance(vector)
    threshold = get_settings().resource_match_threshold
    rows = await session.execute(
        select(Resource, distance)
        .where(
            Resource.embedding.is_not(None),
            Resource.status == ResourceStatus.ACTIVE,
            Resource.url_hash.not_in(exclude) if exclude else true(),
        )
        .order_by(distance)
        .limit(limit)
    )
    return [resource_out(r) for r, d in rows if 1 - float(d) >= threshold]


async def log_search(session: AsyncSession, query: str, match: Match, result_count: int) -> None:
    session.add(
        SearchEvent(
            query=query.strip().lower()[:200],
            matched_kind=match.kind,
            match_method=match.method,
            topic_id=match.topic.id if match.topic else None,
            concept_id=match.concept.id if match.concept else None,
            domain_id=match.domain_id,
            similarity=match.similarity,
            result_count=result_count,
        )
    )
    await session.commit()


async def search(
    session: AsyncSession,
    query: str,
    *,
    format: ResourceFormat | None = None,
    source: str | None = None,
    min_year: int | None = None,
) -> SearchOut:
    if not query.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Enter a topic to search for.")
    settings = get_settings()
    match = await match_query(session, query)
    if match.kind == MatchKind.NONE:
        await log_search(session, query, match, 0)
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            {
                "message": f"“{query.strip()}” doesn’t match a Computer Science topic we cover yet.",
                "suggestions": match.suggestions,
            },
        )

    topic = match.topic
    looked_up = f"{match.concept.name} {
        topic.name}" if match.concept and topic else (topic or match.concept).name
    results: list[ResourceOut] = []
    if topic is not None:
        curated = await session.scalars(
            select(Resource)
            .where(
                Resource.topic_id == topic.id,
                Resource.origin == ResourceOrigin.CURATED,
                Resource.status == ResourceStatus.ACTIVE,
            )
            .order_by(Resource.published_at.desc())
        )
        results = [resource_out(r) for r in curated]

    vector = match.query_vector or await embed_query(query.strip())
    scraped = await scraped_candidates(session, query, looked_up, vector)
    if settings.search_demo:
        fetched, failed, cached = demo_results(
            looked_up) + [c.resource for c in rank(scraped)], [], False
    else:
        candidates, failed, cached = await fetch_from_sources(session, looked_up, settings)
        fetched = [c.resource for c in rank(candidates + scraped)]

    seen = {r.url_hash for r in results}
    fetched = [r for r in fetched if r.url_hash not in seen]
    stored = {
        r.url_hash: r
        for r in await session.scalars(select(Resource).where(Resource.url_hash.in_([r.url_hash for r in fetched])))
    }
    for result in fetched:
        if (match_row := stored.get(result.url_hash)) is not None and match_row.review_count:
            result.avg_rating, result.review_count = float(
                match_row.avg_rating), match_row.review_count

    results += fetched
    if format is not None:
        results = [r for r in results if r.format == format]
    if source:
        results = [r for r in results if r.source.lower() == source.lower()]
    if min_year:
        results = [
            r for r in results if r.published_year and r.published_year >= min_year]

    related = await related_resources(session, vector, {r.url_hash for r in results})
    out = SearchOut(
        query=query,
        topic=topic.name if topic else match.concept.name,
        match=MatchOut(
            kind=match.kind.value,
            name=(match.concept or match.topic).name,
            method=match.method,
            path=await match_path(session, match),
        ),
        results=results,
        related=related,
        suggestions=match.suggestions,
        failed_sources=failed,
        cached=cached,
    )
    await log_search(session, query, match, len(results))
    return out
