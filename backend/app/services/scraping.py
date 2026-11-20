import hashlib
import json
import logging
import httpx
from sqlalchemy import case, delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import Settings, get_settings
from app.core.embeddings import embed_passages
from app.models import ScrapedItem, ScrapeRun
from app.models.base import ScrapeStatus
from app.scrapers.base import ScrapedRecord, Scraper
from app.scrapers.fetcher import FetchError, PoliteFetcher, user_agent
from app.scrapers.devalue import DevalueError
from app.services.urls import normalize_url

log = logging.getLogger(__name__)

BATCH = 200
EMBED_BATCH = 64
MAX_LOGGED_ERRORS = 10


def _row(scraper: Scraper, record: ScrapedRecord) -> dict:
    row = {
        "scraper": scraper.key,
        "external_id": record.external_id[:300],
        "parent_external_id": record.parent_external_id[:300] if record.parent_external_id else None,
        "source": scraper.source,
        "url": record.url,
        "url_hash": normalize_url(record.url)[1],
        "title": record.title[:500],
        "format": record.format,
        "description": record.description[:2000],
        "authors": [a[:200] for a in record.authors][:10],
        "thumbnail": record.thumbnail,
        "duration_minutes": record.duration_minutes,
        "published_year": record.published_year,
        "extra": record.extra,
        "search_text": " ".join([record.title, record.description, record.keywords, *record.authors])[:20000],
    }
    fingerprint = json.dumps(
        {k: v for k, v in row.items()}, sort_keys=True, default=str)
    row["content_hash"] = hashlib.sha256(fingerprint.encode()).hexdigest()
    return row


async def _save(session: AsyncSession, rows: list[dict], run: ScrapeRun) -> None:
    if not rows:
        return
    existing = dict(
        (
            await session.execute(
                select(ScrapedItem.external_id, ScrapedItem.content_hash).where(
                    ScrapedItem.scraper == rows[0]["scraper"],
                    ScrapedItem.external_id.in_(
                        [r["external_id"] for r in rows]),
                )
            )
        ).all()
    )
    run.items_added += sum(1 for r in rows if r["external_id"] not in existing)
    run.items_updated += sum(
        1 for r in rows if r["external_id"] in existing and existing[r["external_id"]] != r["content_hash"]
    )
    statement = insert(ScrapedItem).values(rows)
    changed = {
        column: statement.excluded[column]
        for column in rows[0]
        if column not in ("scraper", "external_id")
    }
    await session.execute(
        statement.on_conflict_do_update(
            index_elements=["scraper", "external_id"],
            set_={
                **changed,
                "last_seen_at": func.now(),
                "embedding": case(
                    (ScrapedItem.content_hash == statement.excluded.content_hash, ScrapedItem.embedding), else_=None
                ),
            },
        )
    )
    await session.commit()


async def embed_missing(session: AsyncSession, scraper_key: str) -> int:
    done = 0
    while True:
        items = list(
            await session.scalars(
                select(ScrapedItem)
                .where(ScrapedItem.scraper == scraper_key, ScrapedItem.embedding.is_(None))
                .limit(EMBED_BATCH)
            )
        )
        if not items:
            return done
        vectors = await embed_passages([f"{i.title}. {i.description}" for i in items])
        if vectors is None:
            log.warning(
                "Embedding model unavailable; %s items left without embeddings", len(items))
            return done
        for item, vector in zip(items, vectors, strict=True):
            item.embedding = vector
        await session.commit()
        done += len(items)


async def run_scraper(
    session: AsyncSession,
    scraper: Scraper,
    *,
    client: httpx.AsyncClient | None = None,
    settings: Settings | None = None,
) -> ScrapeRun:
    settings = settings or get_settings()
    run = ScrapeRun(scraper=scraper.key, status=ScrapeStatus.RUNNING)
    session.add(run)
    await session.commit()
    await session.refresh(run)

    own_client = client is None
    client = client or httpx.AsyncClient(
        headers={"User-Agent": user_agent(settings.contact_email)}, timeout=20)
    fetcher = PoliteFetcher(client, delay=settings.scrape_delay_seconds)
    seen: set[str] = set()
    batch: list[dict] = []
    fatal: str | None = None
    try:
        async for record in scraper.crawl(fetcher):
            if record.external_id in seen:
                continue
            try:
                row = _row(scraper, record)
            except ValueError as e:  # an unusable link
                scraper.errors.append(f"{record.url}: {e}")
                continue
            seen.add(record.external_id)
            batch.append(row)
            if len(batch) >= BATCH:
                await _save(session, batch, run)
                batch = []
        await _save(session, batch, run)
    except (FetchError, DevalueError, ValueError) as e:
        fatal = str(e)
    finally:
        if own_client:
            await client.aclose()

    run.items_seen = len(seen)
    run.pages_fetched = fetcher.pages_fetched
    run.error_count = len(scraper.errors) + (1 if fatal else 0)
    messages = ([fatal] if fatal else []) + scraper.errors[:MAX_LOGGED_ERRORS]
    if scraper.limit:
        messages.append(f"Trial run limited to {
                        scraper.limit}; nothing was removed.")
    run.message = "\n".join(messages)[:4000]

    if fatal and not seen:
        run.status = ScrapeStatus.FAILED
    elif fatal or scraper.errors:
        run.status = ScrapeStatus.PARTIAL
    else:
        run.status = ScrapeStatus.SUCCEEDED
        if not scraper.limit:
            removed = await session.execute(
                delete(ScrapedItem).where(ScrapedItem.scraper ==
                                          scraper.key, ScrapedItem.last_seen_at < run.started_at)
            )
            run.items_removed = removed.rowcount or 0
    run.finished_at = func.now()
    await session.commit()

    await embed_missing(session, scraper.key)
    await session.refresh(run)
    return run
