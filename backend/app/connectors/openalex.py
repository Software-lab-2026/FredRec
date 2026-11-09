from app.connectors.base import Candidate, Connector, candidate, keep
from app.models.base import ResourceFormat


def abstract(inverted: dict[str, list[int]] | None) -> str:
    if not inverted:
        return ""
    words = sorted((pos, word)
                   for word, positions in inverted.items() for pos in positions)
    return " ".join(word for _, word in words[:80])


class OpenAlex(Connector):
    name = "OpenAlex"

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        params = {
            "search": query,
            "filter": "is_oa:true,language:en",
            "per-page": limit,
            "select": "id,doi,title,publication_year,cited_by_count,type,open_access,authorships,abstract_inverted_index",
        }
        if settings.openalex_api_key:
            params["api_key"] = settings.openalex_api_key
        if settings.contact_email:
            params["mailto"] = settings.contact_email
        response = await client.get("https://api.openalex.org/works", params=params)
        response.raise_for_status()
        results = []
        for position, work in enumerate(response.json().get("results", [])):
            access = work.get("open_access") or {}
            results.append(
                candidate(
                    position,
                    work.get("cited_by_count"),
                    url=access.get("oa_url") or work.get(
                        "doi") or work.get("id"),
                    title=work.get("title"),
                    format=ResourceFormat.TEXTBOOK if work.get(
                        "type") == "book" else ResourceFormat.PAPER,
                    source="OpenAlex",
                    description=abstract(work.get("abstract_inverted_index")),
                    authors=[(a.get("author") or {}).get("display_name")
                             for a in work.get("authorships") or []],
                    published_year=work.get("publication_year"),
                )
            )
        return keep(results, limit)
