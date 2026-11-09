import html
import re
from dataclasses import dataclass
from typing import Any, ClassVar

import httpx

from app.core.config import Settings
from app.schemas.resources import ResourceOut
from app.services.urls import normalize_url

_TAGS = re.compile(r"<[^>]+>")
_SPACES = re.compile(r"\s+")


def clean_text(value: Any, limit: int = 300) -> str:
    if not value:
        return ""
    if isinstance(value, list):
        value = " ".join(str(v) for v in value)
    text = _SPACES.sub(" ", html.unescape(_TAGS.sub(" ", str(value)))).strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + "…"


def year_of(value: Any) -> int | None:
    if value is None:
        return None
    match = re.match(r"\d{4}", str(value))
    return int(match.group()) if match else None


@dataclass
class Candidate:
    resource: ResourceOut
    popularity: float | None = None
    position: int = 0

    def to_json(self) -> dict:
        return {"resource": self.resource.model_dump(mode="json"), "popularity": self.popularity, "position": self.position}

    @classmethod
    def from_json(cls, data: dict) -> "Candidate":
        return cls(ResourceOut.model_validate(data["resource"]), data.get("popularity"), data.get("position", 0))


def candidate(position: int, popularity: float | None = None, **fields) -> Candidate | None:
    url, title = (fields.get("url") or "").strip(
    ), clean_text(fields.get("title"), 300)
    if not url or not title:
        return None
    try:
        url_hash = normalize_url(url)[1]
    except ValueError:
        return None
    fields.update(url=url, title=title, url_hash=url_hash,
                  description=clean_text(fields.get("description")))
    fields["authors"] = [clean_text(a, 100) for a in (
        fields.get("authors") or []) if a][:5]
    return Candidate(ResourceOut(**fields), popularity, position)


class Connector:
    """One search source. Subclasses set `name` and implement `search`."""

    name: ClassVar[str]
    key_setting: ClassVar[str | None] = None
    cache_hours: ClassVar[int] = 24

    def enabled(self, settings: Settings) -> bool:
        return self.key_setting is None or bool(getattr(settings, self.key_setting))

    def key(self, settings: Settings) -> str:
        return getattr(settings, self.key_setting) if self.key_setting else ""

    async def search(self, client: httpx.AsyncClient, query: str, limit: int, settings: Settings) -> list[Candidate]:
        raise NotImplementedError


def keep(candidates: list[Candidate | None], limit: int) -> list[Candidate]:
    return [c for c in candidates if c is not None][:limit]
