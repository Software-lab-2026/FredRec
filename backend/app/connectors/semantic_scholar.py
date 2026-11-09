from app.connectors.base import Candidate, Connector, candidate, keep
from app.models.base import ResourceFormat


class SemanticScholar(Connector):
    name = "Semantic Scholar"
    key_setting = "semantic_scholar_api_key"

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        response = await client.get(
            "https://api.semanticscholar.org/graph/v1/paper/search",
            params={
                "query": query,
                "limit": limit,
                "fields": "title,url,abstract,year,authors,citationCount,openAccessPdf",
                "openAccessPdf": "",
            },
            headers={"x-api-key": self.key(settings)},
        )
        response.raise_for_status()
        results = []
        for position, paper in enumerate(response.json().get("data") or []):
            pdf = (paper.get("openAccessPdf") or {}).get("url")
            results.append(
                candidate(
                    position,
                    paper.get("citationCount"),
                    url=pdf or paper.get("url"),
                    title=paper.get("title"),
                    format=ResourceFormat.PAPER,
                    source="Semantic Scholar",
                    description=paper.get("abstract"),
                    authors=[a.get("name")
                             for a in paper.get("authors") or []],
                    published_year=paper.get("year"),
                )
            )
        return keep(results, limit)
