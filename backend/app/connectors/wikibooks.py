from urllib.parse import quote

from app.connectors.base import Candidate, Connector, candidate, keep, year_of
from app.models.base import ResourceFormat


class Wikibooks(Connector):
    name = "Wikibooks"

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        response = await client.get(
            "https://en.wikibooks.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srnamespace": 0,
                "srlimit": limit,
                "format": "json",
            },
        )
        response.raise_for_status()
        results = []
        for position, page in enumerate((response.json().get("query") or {}).get("search") or []):
            title = page.get("title", "")
            results.append(
                candidate(
                    position,
                    page.get("wordcount"),
                    url=f"https://en.wikibooks.org/wiki/{
                        quote(title.replace(' ', '_'))}",
                    title=title.replace("/", " › "),
                    format=ResourceFormat.TEXTBOOK,
                    source="Wikibooks",
                    description=page.get("snippet"),
                    authors=["Wikibooks contributors"],
                    published_year=year_of(page.get("timestamp")),
                )
            )
        return keep(results, limit)
