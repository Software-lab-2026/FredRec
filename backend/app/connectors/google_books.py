from app.connectors.base import Candidate, Connector, candidate, keep, year_of
from app.models.base import ResourceFormat


class GoogleBooks(Connector):
    name = "Google Books"
    key_setting = "google_books_api_key"

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        response = await client.get(
            "https://www.googleapis.com/books/v1/volumes",
            params={
                "q": query,
                "filter": "free-ebooks",
                "printType": "books",
                "langRestrict": "en",
                "maxResults": limit,
                "key": self.key(settings),
            },
        )
        response.raise_for_status()
        results = []
        for position, item in enumerate(response.json().get("items") or []):
            info = item.get("volumeInfo") or {}
            link = (info.get("previewLink") or info.get("infoLink")
                    or "").replace("http://", "https://", 1)
            title = info.get(
                "title", "") + (f": {info['subtitle']}" if info.get("subtitle") else "")
            results.append(
                candidate(
                    position,
                    url=link,
                    title=title,
                    format=ResourceFormat.TEXTBOOK,
                    source="Google Books",
                    description=info.get("description"),
                    authors=info.get("authors") or [],
                    pages=info.get("pageCount"),
                    published_year=year_of(info.get("publishedDate")),
                    thumbnail=((info.get("imageLinks") or {}).get(
                        "thumbnail") or "").replace("http://", "https://", 1)
                    or None,
                )
            )
        return keep(results, limit)
