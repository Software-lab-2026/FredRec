import re
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, ClassVar

from app.models.base import ResourceFormat
from app.scrapers.fetcher import PoliteFetcher

_SPACES = re.compile(r"\s+")


def squash(text: str | None) -> str:
    return _SPACES.sub(" ", text or "").strip()


_MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
_MD_EMPHASIS = re.compile(
    r"(?<![\w*_])[*_]{1,2}(?=\S)(.+?)(?<=\S)[*_]{1,2}(?![\w*_])")
_PEOPLE_SPLIT = re.compile(
    r"\s*(?:,|;|&|\band\b)\s*(?=(?:Prof|Dr|Mr|Ms|Mrs|Shri|Smt)\b\.?)")


def plain_markdown(text: str | None) -> str:
    return squash(_MD_EMPHASIS.sub(r"\1", _MD_LINK.sub(r"\1", text or "")))


def people(text: str | None) -> list[str]:
    return [p for p in (squash(x) for x in _PEOPLE_SPLIT.split(text or "")) if p]


@dataclass
class ScrapedRecord:
    external_id: str
    url: str
    title: str
    format: ResourceFormat
    description: str = ""
    authors: list[str] = field(default_factory=list)
    thumbnail: str | None = None
    duration_minutes: int | None = None
    published_year: int | None = None
    parent_external_id: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)
    keywords: str = ""


class Scraper:
    key: ClassVar[str]
    source: ClassVar[str]

    def __init__(self, limit: int | None = None):
        self.limit = limit
        self.errors: list[str] = []

    def crawl(self, fetcher: PoliteFetcher) -> AsyncIterator[ScrapedRecord]:
        raise NotImplementedError
