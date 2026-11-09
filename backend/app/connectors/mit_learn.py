from app.connectors.base import Candidate, Connector, candidate, keep
from app.models.base import ResourceFormat


class MitLearn(Connector):
    name = "MIT OpenCourseWare"

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        response = await client.get(
            "https://api.learn.mit.edu/api/v1/learning_resources_search/",
            params={"q": query, "platform": "ocw",
                    "resource_type": "course", "free": "true", "limit": limit},
        )
        response.raise_for_status()
        results = []
        for position, course in enumerate(response.json().get("results", [])):
            runs = course.get("runs") or []
            years = [r.get("year")
                     for r in runs if isinstance(r.get("year"), int)]
            instructors = [i.get("full_name") for r in runs[:1] for i in r.get(
                "instructors") or [] if isinstance(i, dict)]
            results.append(
                candidate(
                    position,
                    course.get("views"),
                    url=course.get("url"),
                    title=course.get("title"),
                    format=ResourceFormat.COURSE,
                    source=self.name,
                    description=course.get("description"),
                    authors=instructors,
                    thumbnail=(course.get("image") or {}).get("url"),
                    published_year=max(years) if years else None,
                )
            )
        return keep(results, limit)
