import re

from app.connectors.base import Candidate, Connector, candidate, keep, year_of
from app.models.base import ResourceFormat

LEARNING = re.compile(
    r"awesome|tutorial|course|book|guide|roadmap|learn|beginner|interview|notes|lecture|cheat.?sheet|exercise|curriculum",
    re.IGNORECASE,
)


class GitHub(Connector):
    name = "GitHub"

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        headers = {"Accept": "application/vnd.github+json"}
        if settings.github_token:
            headers["Authorization"] = f"Bearer {settings.github_token}"
        response = await client.get(
            "https://api.github.com/search/repositories",
            params={"q": f"{query} in:name,description,topics stars:>50",
                    "sort": "stars", "per_page": 50},
            headers=headers,
        )
        response.raise_for_status()
        repos = [
            r
            for r in response.json().get("items") or []
            if LEARNING.search(" ".join([r.get("full_name") or "", r.get("description") or "", *(r.get("topics") or [])]))
        ]
        results = []
        for position, repo in enumerate(repos):
            results.append(
                candidate(
                    position,
                    repo.get("stargazers_count"),
                    url=repo.get("html_url"),
                    title=repo.get("full_name"),
                    format=ResourceFormat.REPO,
                    source="GitHub",
                    description=repo.get("description"),
                    authors=[(repo.get("owner") or {}).get("login")],
                    published_year=year_of(repo.get("pushed_at")),
                )
            )
        return keep(results, limit)
