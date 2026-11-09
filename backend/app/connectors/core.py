from app.connectors.base import Candidate, Connector, candidate, keep
from app.models.base import ResourceFormat


class Core(Connector):
    name = "CORE"
    key_setting = "core_api_key"

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        response = await client.get(
            "https://api.core.ac.uk/v3/search/works/",
            params={"q": f'title:"{query}" OR abstract:"{
                query}"', "limit": limit},
            headers={"Authorization": f"Bearer {self.key(settings)}"},
        )
        response.raise_for_status()
        results = []
        for position, work in enumerate(response.json().get("results") or []):
            results.append(
                candidate(
                    position,
                    work.get("citationCount"),
                    url=work.get(
                        "downloadUrl") or f"https://core.ac.uk/works/{work.get('id')}",
                    title=work.get("title"),
                    format=ResourceFormat.PAPER,
                    source="CORE",
                    description=work.get("abstract"),
                    authors=[a.get("name") for a in work.get("authors") or []],
                    published_year=work.get("yearPublished"),
                )
            )
        return keep(results, limit)
