import re
from collections.abc import AsyncIterator
from urllib.parse import urljoin, urlsplit
from xml.etree import ElementTree
from bs4 import BeautifulSoup
from app.models.base import ResourceFormat
from app.scrapers.base import ScrapedRecord, Scraper, plain_markdown, squash
from app.scrapers.fetcher import Blocked, FetchError, PoliteFetcher

BASE = "https://ocw.mit.edu"
COURSE_PREFIXES = ("6-",)
_SITEMAP_NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
_NUMBERED = re.compile(
    r"^(lecture|lec|recitation|session|problem session|ses)\b", re.I)
_NOTES_WANTED = re.compile(r"lecture|notes|slides|handout|reading", re.I)
_NOTES_UNWANTED = re.compile(
    r"solution|exam|quiz|problem set|pset|assignment|homework", re.I)


def sitemap_locations(xml: str) -> list[str]:
    root = ElementTree.fromstring(xml)
    return [squash(loc.text) for loc in root.iterfind(".//s:loc", _SITEMAP_NS) if loc.text]


def course_slug(url: str) -> str | None:
    match = re.match(r"^/courses/([^/]+)/", urlsplit(url).path)
    return match.group(1) if match else None


def _with_course(name: str, course: str) -> str:
    return f"{course}, {name}" if _NUMBERED.match(name) else name


def parse_course_home(html: str, url: str) -> dict:
    page = BeautifulSoup(html, "html.parser")

    def meta(attr: str, name: str) -> str:
        tag = page.find("meta", attrs={attr: name})
        return squash(tag.get("content")) if tag else ""

    title = meta("property", "og:title").split(" | ")[
        0] or squash(page.title.string if page.title else "")
    term_detail = page.select_one(".course-number-term-detail")
    term_bits = [squash(t) for t in term_detail.get_text(
        "|").split("|") if squash(t)] if term_detail else []
    year = next((int(m.group()) for bit in term_bits if (
        m := re.search(r"\b(19|20)\d{2}\b", bit))), None)
    instructors = list(dict.fromkeys(squash(a.get_text())
                       for a in page.select("a.course-info-instructor")))
    topics = list(dict.fromkeys(squash(a.get_text())
                  for a in page.select('a[href*="/search/?t="]')))
    return {
        "title": title,
        "description": plain_markdown(meta("name", "description")),
        "image": meta("property", "og:image") or None,
        "number": term_bits[0] if term_bits else "",
        "term": term_bits[1] if len(term_bits) > 1 else "",
        "level": term_bits[2] if len(term_bits) > 2 else "",
        "year": year,
        "instructors": [i for i in instructors if i],
        "topics": [t for t in topics if t],
        "url": url,
    }


def parse_videos(html: str, page_url: str) -> list[dict]:
    page = BeautifulSoup(html, "html.parser")
    videos = []
    for link in page.select("a.video-link[href]"):
        name = squash(link.get_text(" "))
        image = link.find("img")
        if name:
            videos.append(
                {
                    "url": urljoin(page_url, link["href"]),
                    "title": name,
                    "thumbnail": image.get("src") if image and image.get("src") else None,
                }
            )
    return videos


def parse_notes(html: str, page_url: str) -> list[dict]:
    page = BeautifulSoup(html, "html.parser")
    content = page.select_one("main#course-content-section") or page
    notes, seen = [], set()
    for link in content.select('a[href*="/resources/"]'):
        name = squash(re.sub(r"\(PDF[^)]*\)", "", link.get_text(" ")))
        url = urljoin(page_url, link["href"])
        if not name or url in seen or _NOTES_UNWANTED.search(name) or not _NOTES_WANTED.search(name):
            continue
        seen.add(url)
        notes.append({"url": url, "title": name})
    return notes


class MitOcw(Scraper):
    key = "mit_ocw"
    source = "MIT OpenCourseWare"

    async def crawl(self, fetcher: PoliteFetcher) -> AsyncIterator[ScrapedRecord]:
        course_maps = [
            loc
            for loc in sitemap_locations(await fetcher.text(f"{BASE}/sitemap.xml"))
            if (slug := course_slug(loc)) and slug.startswith(COURSE_PREFIXES)
        ]
        for course_map in course_maps[: self.limit] if self.limit else course_maps:
            try:
                for record in await self.course(fetcher, course_map):
                    yield record
            except Blocked:
                raise
            except (FetchError, ElementTree.ParseError) as e:
                self.errors.append(f"MIT OCW {course_slug(course_map)}: {e}")

    async def course(self, fetcher: PoliteFetcher, course_map: str) -> list[ScrapedRecord]:
        slug = course_slug(course_map)
        home_url = f"{BASE}/courses/{slug}/"
        pages = sitemap_locations(await fetcher.text(course_map))
        info = parse_course_home(await fetcher.text(home_url), home_url)
        if not info["title"]:
            raise FetchError(f"{home_url}: no course title found")
        name = info["title"]
        label = " ".join(p for p in (info["number"], name) if p)
        when = info["term"]
        records = [
            ScrapedRecord(
                external_id=slug,
                url=home_url,
                title=name,
                format=ResourceFormat.COURSE,
                description=info["description"],
                authors=info["instructors"][:5],
                thumbnail=info["image"],
                published_year=info["year"],
                extra={"number": info["number"], "term": info["term"],
                       "level": info["level"], "topics": info["topics"]},
                keywords=" ".join([info["number"], *info["topics"]]),
            )
        ]
        context = f"from MIT {label}" + (f" ({when})" if when else "")
        for gallery in [p for p in pages if "/video_galleries/" in p]:
            for video in parse_videos(await fetcher.text(gallery), gallery):
                records.append(
                    ScrapedRecord(
                        external_id=f"{slug}:{urlsplit(video['url']).path}",
                        parent_external_id=slug,
                        url=video["url"],
                        title=_with_course(video["title"], name),
                        format=ResourceFormat.VIDEO,
                        description=f"Lecture video {
                            context}, MIT OpenCourseWare.",
                        authors=info["instructors"][:3],
                        thumbnail=video["thumbnail"],
                        published_year=info["year"],
                        extra={"course": name, "number": info["number"]},
                        keywords=name,
                    )
                )
        for notes_page in [p for p in pages if p.rstrip("/").endswith("/pages/lecture-notes")]:
            for note in parse_notes(await fetcher.text(notes_page), notes_page):
                records.append(
                    ScrapedRecord(
                        external_id=f"{slug}:{urlsplit(note['url']).path}",
                        parent_external_id=slug,
                        url=note["url"],
                        title=_with_course(note["title"], name),
                        format=ResourceFormat.NOTES,
                        description=f"Lecture notes {
                            context}, MIT OpenCourseWare.",
                        authors=info["instructors"][:3],
                        published_year=info["year"],
                        extra={"course": name, "number": info["number"]},
                        keywords=name,
                    )
                )
        return records
