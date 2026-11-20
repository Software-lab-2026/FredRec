import logging
import re
from collections.abc import AsyncIterator
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

from app.models.base import ResourceFormat
from app.scrapers.base import ScrapedRecord, Scraper, squash
from app.scrapers.fetcher import FetchError, PoliteFetcher

log = logging.getLogger(__name__)

PAGE = "https://teachyourselfcs.com/"
PAID_HOSTS = ("amazon.", "bookshop.org",
              "barnesandnoble.com", "csapp.cs.cmu.edu")
SKIPPED_HOSTS = ("reddit.com", "twitter.com", "x.com",
                 "facebook.com", "leetcode.com", "news.ycombinator.com")
_GENERIC_WHOLE = re.compile(
    r"^(book|here|this one|elsewhere|online|link|lectures?|videos?|video lectures)$", re.I)
_GENERIC_START = re.compile(
    r"^(a|an|the|this|that|on|his|her|their|watch|recordings? of)\s", re.I)
_GENERIC_ANYWHERE = re.compile(
    r"\b(generously|provides?|provided|available|would cover)\b|,\s*on\b|’s,|'s,", re.I)
_LEADING_FILLER = re.compile(
    r"^((a|an|the|this|that|on|his|her|their|watch|recordings? of)\s+)+", re.I)
_USELESS_TITLE = re.compile(
    r"^(home|index|untitled|welcome|internet archive|youtube|coursera|edx)\b", re.I)
_LABELS = {
    ResourceFormat.VIDEO: "lecture videos",
    ResourceFormat.COURSE: "course",
    ResourceFormat.TEXTBOOK: "book",
    ResourceFormat.NOTES: "notes",
    ResourceFormat.REPO: "repository",
    ResourceFormat.ARTICLE: "guide",
    ResourceFormat.PAPER: "paper",
}
_VIDEO_HOSTS = ("youtube.com", "youtu.be", "archive.org", "vimeo.com")
_COURSE_HOSTS = ("coursera.org", "edx.org", "ocw.mit.edu",
                 "nand2tetris.org", "exercism")


def is_paid_or_skipped(url: str) -> bool:
    host = urlsplit(url).netloc.lower()
    return any(h in host for h in PAID_HOSTS + SKIPPED_HOSTS)


def needs_better_title(text: str) -> bool:
    text = squash(text)
    return (
        len(text.split()) < 2
        or bool(_GENERIC_WHOLE.match(text) or _GENERIC_START.match(text) or _GENERIC_ANYWHERE.search(text))
    )


def useful_page_title(title: str) -> bool:
    return bool(title) and not _USELESS_TITLE.match(title) and not needs_better_title(title)


def choose_title(text: str, fetched: str, subject: str, format: ResourceFormat, url: str) -> str:
    if not needs_better_title(text):
        return text
    if useful_page_title(fetched):
        return fetched
    trimmed = _LEADING_FILLER.sub("", text).strip()
    if trimmed and not needs_better_title(trimmed) and not _USELESS_TITLE.match(trimmed):
        return trimmed
    host = urlsplit(url).netloc.lower().removeprefix("www.")
    return f"{subject} {_LABELS[format]} ({host})"


def guess_format(url: str, text: str) -> ResourceFormat:
    host, path, words = urlsplit(url).netloc.lower(
    ), urlsplit(url).path.lower(), text.lower()
    if path.endswith(".pdf"):
        return ResourceFormat.TEXTBOOK if re.search(r"\bbook\b", words) else ResourceFormat.NOTES
    if any(h in host for h in _VIDEO_HOSTS) or "video" in path:
        return ResourceFormat.VIDEO
    if "github.com" in host:
        return ResourceFormat.REPO
    if any(h in host for h in _COURSE_HOSTS):
        return ResourceFormat.COURSE
    if re.search(r"\b(videos?|lectures|recordings?|talk|playlist)\b", words):
        return ResourceFormat.VIDEO
    if re.search(r"\bcourses?\b|\bcs\s?\d", words):
        return ResourceFormat.COURSE
    if re.search(r"\b(book|programs|interpreters|pieces|systems|readings)\b", words):
        return ResourceFormat.TEXTBOOK
    return ResourceFormat.ARTICLE


def subject_links(html: str) -> list[tuple[str, str, str, str]]:
    page = BeautifulSoup(html, "html.parser")
    found = []
    for heading in page.select("h3[id]"):
        subject = squash(heading.get_text())
        # Walk the page in reading order until the next heading: sections aren't wrapped in one element.
        for element in heading.find_all_next(["a", "h2", "h3"]):
            if element.name in ("h2", "h3"):
                break
            if element.get("href"):
                found.append((heading["id"], subject, urljoin(
                    PAGE, element["href"]), squash(element.get_text(" "))))
    return found


def page_title(html: str) -> str:
    page = BeautifulSoup(html, "html.parser")
    og = page.find("meta", attrs={"property": "og:title"})
    title = squash(og.get("content")) if og and og.get(
        "content") else squash(page.title.string if page.title else "")
    return re.split(r"\s+[|–—]\s+", title)[0] if title else ""


class TeachYourselfCs(Scraper):
    key = "tycs"
    source = "Teach Yourself CS"

    async def crawl(self, fetcher: PoliteFetcher) -> AsyncIterator[ScrapedRecord]:
        links = subject_links(await fetcher.text(PAGE))
        if not links:
            raise FetchError(
                "Teach Yourself CS: no subject sections found (has the page changed?)")
        subjects = list(dict.fromkeys(subject_id for subject_id, *_ in links))
        if self.limit:
            subjects = subjects[: self.limit]
        best: dict[str, tuple[str, str, str]] = {}
        for subject_id, subject, url, text in links:
            if subject_id not in subjects or not url.startswith("http") or urlsplit(url).netloc.endswith("teachyourselfcs.com"):
                continue
            if is_paid_or_skipped(url):
                continue
            if url not in best or (text and not best[url][2]):
                best[url] = (subject_id, subject, text)

        for url, (subject_id, subject, text) in best.items():
            fetched = ""
            if needs_better_title(text) and not urlsplit(url).path.lower().endswith(".pdf"):
                try:
                    fetched = page_title(await fetcher.text(url))
                except FetchError as e:
                    log.info("No title for %s: %s", url, e)
            format = guess_format(url, f"{text} {fetched}")
            title = choose_title(text, fetched, subject, format, url)
            if len(title.split()) < 3 and not title.startswith(subject):
                title = f"{subject}: {title}"
            yield ScrapedRecord(
                external_id=url,
                url=url,
                title=title,
                format=format,
                description=f"Recommended in Teach Yourself CS’s {
                    subject} guide.",
                extra={"subject": subject, "guide": f"{PAGE}#{subject_id}"},
                keywords=subject,
            )
