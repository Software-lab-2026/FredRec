import re

from app.connectors.base import Candidate, Connector, candidate, keep, year_of
from app.models.base import ResourceFormat


def tag_for(query: str) -> str:
    return re.sub(r"[^a-z0-9]", "", query.lower())


class DevTo(Connector):
    name = "dev.to"

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        tag = tag_for(query)
        if not tag:
            return []
        response = await client.get("https://dev.to/api/articles", params={"tag": tag, "per_page": limit, "top": 365})
        response.raise_for_status()
        results = []
        for position, article in enumerate(response.json() or []):
            results.append(
                candidate(
                    position,
                    article.get("public_reactions_count"),
                    url=article.get("url"),
                    title=article.get("title"),
                    format=ResourceFormat.ARTICLE,
                    source="dev.to",
                    description=article.get("description"),
                    authors=[(article.get("user") or {}).get("name")],
                    duration_minutes=article.get("reading_time_minutes"),
                    published_year=year_of(article.get("published_at")),
                    thumbnail=article.get("cover_image"),
                )
            )
        return keep(results, limit)
