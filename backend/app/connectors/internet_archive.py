from app.connectors.base import Candidate, Connector, candidate, keep, year_of
from app.models.base import ResourceFormat

LEARNING_WORDS = "lecture OR lectures OR course OR tutorial OR textbook OR introduction OR notes OR guide"
LEARNING_SUBJECTS = "lecture OR course OR education OR textbook OR tutorial"


class InternetArchive(Connector):
    name = "Internet Archive"

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        response = await client.get(
            "https://archive.org/advancedsearch.php",
            params={
                "q": f'title:("{query}") AND (title:({LEARNING_WORDS}) OR subject:({LEARNING_SUBJECTS}))'
                " AND mediatype:(texts OR movies) AND licenseurl:(*creativecommons* OR *publicdomain*)",
                "fl[]": ["identifier", "title", "mediatype", "year", "creator", "downloads", "description"],
                "sort[]": "downloads desc",
                "rows": limit,
                "output": "json",
            },
        )
        response.raise_for_status()
        results = []
        for position, item in enumerate((response.json().get("response") or {}).get("docs") or []):
            identifier = item.get("identifier")
            creator = item.get("creator")
            results.append(
                candidate(
                    position,
                    item.get("downloads"),
                    url=f"https://archive.org/details/{
                        identifier}" if identifier else None,
                    title=item.get("title"),
                    format=ResourceFormat.VIDEO if item.get(
                        "mediatype") == "movies" else ResourceFormat.TEXTBOOK,
                    source="Internet Archive",
                    description=item.get("description"),
                    authors=creator if isinstance(
                        creator, list) else [creator],
                    published_year=year_of(item.get("year")),
                    thumbnail=f"https://archive.org/services/img/{
                        identifier}" if identifier else None,
                )
            )
        return keep(results, limit)
