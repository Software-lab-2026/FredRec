import xml.etree.ElementTree as ET

from app.connectors.base import Candidate, Connector, candidate, keep, year_of
from app.models.base import ResourceFormat

ATOM = {"a": "http://www.w3.org/2005/Atom"}


class ArXiv(Connector):

    name = "arXiv"

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        response = await client.get(
            "https://export.arxiv.org/api/query",
            params={
                "search_query": f'all:"{query}" AND cat:cs.*',
                "max_results": limit,
                "sortBy": "relevance",
            },
        )
        response.raise_for_status()
        root = ET.fromstring(response.text)
        results = []
        for position, entry in enumerate(root.findall("a:entry", ATOM)):
            link = next(
                (l.get("href") for l in entry.findall(
                    "a:link", ATOM) if l.get("rel") == "alternate"),
                entry.findtext("a:id", default="", namespaces=ATOM),
            )
            results.append(
                candidate(
                    position,
                    url=link,
                    title=entry.findtext(
                        "a:title", default="", namespaces=ATOM),
                    format=ResourceFormat.PAPER,
                    source="arXiv",
                    description=entry.findtext(
                        "a:summary", default="", namespaces=ATOM),
                    authors=[a.findtext("a:name", default="", namespaces=ATOM)
                             for a in entry.findall("a:author", ATOM)],
                    published_year=year_of(entry.findtext(
                        "a:published", default="", namespaces=ATOM)),
                )
            )
        return keep(results, limit)
