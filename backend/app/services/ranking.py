import math
import re
from datetime import datetime
from app.connectors.base import Candidate

RELEVANCE, POPULARITY, RECENCY = 0.55, 0.30, 0.15


def _title_key(title: str) -> str:
    return re.sub(r"[^a-z0-9]", "", title.lower())


def _scores(candidates: list[Candidate]) -> dict[int, float]:
    by_source: dict[str, list[Candidate]] = {}
    for c in candidates:
        by_source.setdefault(c.resource.source, []).append(c)
    this_year = datetime.now().year
    scores: dict[int, float] = {}
    for group in by_source.values():
        top = max((math.log1p(c.popularity)
                  for c in group if c.popularity), default=0.0)
        size = max(len(group), 1)
        for c in group:
            relevance = 1 - c.position / size
            popularity = math.log1p(c.popularity) / \
                top if top and c.popularity else 0.0
            year = c.resource.published_year
            recency = max(0.0, 1 - (this_year - year) / 25) if year else 0.3
            scores[id(c)] = RELEVANCE * relevance + \
                POPULARITY * popularity + RECENCY * recency
    return scores


def rank(candidates: list[Candidate]) -> list[Candidate]:
    scores = _scores(candidates)
    ordered = sorted(candidates, key=lambda c: scores[id(c)], reverse=True)
    seen_links: set[str] = set()
    seen_titles: set[tuple[str, str]] = set()
    unique = []
    for c in ordered:
        title = (c.resource.format.value, _title_key(c.resource.title))
        if c.resource.url_hash in seen_links or title in seen_titles:
            continue
        seen_links.add(c.resource.url_hash)
        seen_titles.add(title)
        unique.append(c)
    return unique
