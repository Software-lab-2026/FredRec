from app.connectors.base import Candidate, Connector, candidate, keep
from app.models.base import ResourceFormat

ACCESS = {
    "public": "Free to read online.",
    "borrowable": "Free to borrow online with an Open Library account.",
}


class OpenLibrary(Connector):
    name = "Open Library"

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        response = await client.get(
            "https://openlibrary.org/search.json",
            params={
                "q": query,
                "has_fulltext": "true",
                "limit": limit * 2,
                "fields": "key,title,author_name,first_publish_year,number_of_pages_median,ebook_access,cover_i",
            },
        )
        response.raise_for_status()
        results = []
        books = [b for b in response.json().get(
            "docs", []) if b.get("ebook_access") in ACCESS]
        for position, book in enumerate(books):
            cover = book.get("cover_i")
            results.append(
                candidate(
                    position,
                    url=f"https://openlibrary.org{
                        book.get('key', '')}" if book.get("key") else None,
                    title=book.get("title"),
                    format=ResourceFormat.TEXTBOOK,
                    source="Open Library",
                    description=ACCESS[book["ebook_access"]],
                    authors=book.get("author_name") or [],
                    pages=book.get("number_of_pages_median"),
                    published_year=book.get("first_publish_year"),
                    thumbnail=f"https://covers.openlibrary.org/b/id/{
                        cover}-M.jpg" if cover else None,
                )
            )
        return keep(results, limit)
