import html
import math
import re

from app.connectors.base import Candidate, Connector, candidate, keep, year_of
from app.models.base import ResourceFormat

_DURATION = re.compile(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")


def minutes(iso: str | None) -> int | None:
    match = _DURATION.fullmatch(iso or "")
    if not match:
        return None
    days, hours, mins, secs = (int(g or 0) for g in match.groups())
    return max(1, math.ceil((days * 86400 + hours * 3600 + mins * 60 + secs) / 60))


class YouTube(Connector):
    name = "YouTube"
    key_setting = "youtube_api_key"
    cache_hours = 24 * 7

    async def search(self, client, query, limit, settings) -> list[Candidate]:
        key = self.key(settings)
        found = await client.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "type": "video",
                "q": f"{query} tutorial",
                "maxResults": limit,
                "relevanceLanguage": "en",
                "safeSearch": "strict",
                "key": key,
            },
        )
        found.raise_for_status()
        items = [i for i in found.json().get(
            "items", []) if i.get("id", {}).get("videoId")]
        if not items:
            return []
        details = await client.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={"part": "contentDetails,statistics", "id": ",".join(
                i["id"]["videoId"] for i in items), "key": key},
        )
        details.raise_for_status()
        extra = {v["id"]: v for v in details.json().get("items", [])}
        results = []
        for position, item in enumerate(items):
            video_id, snippet = item["id"]["videoId"], item["snippet"]
            info = extra.get(video_id, {})
            views = info.get("statistics", {}).get("viewCount")
            results.append(
                candidate(
                    position,
                    float(views) if views else None,
                    url=f"https://www.youtube.com/watch?v={video_id}",
                    title=html.unescape(snippet.get("title", "")),
                    format=ResourceFormat.VIDEO,
                    source="YouTube",
                    description=snippet.get("description"),
                    authors=[snippet.get("channelTitle")],
                    thumbnail=(snippet.get("thumbnails", {}).get(
                        "medium") or {}).get("url"),
                    duration_minutes=minutes(
                        info.get("contentDetails", {}).get("duration")),
                    published_year=year_of(snippet.get("publishedAt")),
                )
            )
        return keep(results, limit)
