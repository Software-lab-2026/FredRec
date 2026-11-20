import re
from collections.abc import AsyncIterator
from app.models.base import ResourceFormat
from app.scrapers.base import ScrapedRecord, Scraper, people, squash
from app.scrapers.devalue import DevalueError, page_data
from app.scrapers.fetcher import Blocked, FetchError, PoliteFetcher

BASE = "https://nptel.ac.in"
_GENERIC_LECTURE = re.compile(
    r"^(tutorial|lecture|lec|week|module|part|session|introduction)[\s\d.:\-–]*$", re.I)


def course_title(raw: str) -> str:
    return squash(re.sub(r"^\s*NOC\s*:\s*", "", raw or ""))


def lecture_title(lecture: str, course: str) -> str:
    # "#2 Analogy for …" → "Analogy for …"
    lecture = squash(re.sub(r"^#\d+\s*", "", lecture or ""))
    return f"{course}: {lecture}" if _GENERIC_LECTURE.match(lecture) or len(lecture) < 4 else lecture


class Nptel(Scraper):
    key = "nptel"
    source = "NPTEL"

    async def crawl(self, fetcher: PoliteFetcher) -> AsyncIterator[ScrapedRecord]:
        catalogue = page_data(await fetcher.json(f"{BASE}/courses/__data.json"))
        cs_ids = {
            str(d["id"]) for d in catalogue.get("disciplines") or [] if "computer science" in (d.get("name") or "").lower()
        }
        if not cs_ids:
            raise FetchError(
                "NPTEL: no Computer Science discipline in the catalogue (has the site changed?)")
        courses = [c for c in catalogue.get("courses") or [] if str(
            c.get("disciplineId")) in cs_ids and c.get("id")]
        for course in courses[: self.limit] if self.limit else courses:
            outline = None
            try:
                outline = page_data(await fetcher.json(f"{BASE}/courses/{course['id']}/__data.json")).get("courseOutline")
            except Blocked:
                raise
            except (FetchError, DevalueError, KeyError, TypeError) as e:
                self.errors.append(f"NPTEL course {course['id']}: {e}")
            for record in self.records(course, outline or {}):
                yield record

    def records(self, course: dict, outline: dict) -> list[ScrapedRecord]:
        course_id = str(course["id"])
        title = course_title(outline.get("title") or course.get("title"))
        professor = squash(outline.get("professor") or course.get("professor"))
        professors = people(professor)
        institute = squash(outline.get("instituteName")
                           or course.get("instituteName"))
        by = ", ".join(p for p in (professor, institute) if p)
        lectures = [
            (squash(unit.get("name")), lesson)
            for unit in outline.get("units") or []
            for lesson in unit.get("lessons") or []
            if lesson.get("name")
        ]
        names = [squash(lesson["name"]) for _, lesson in lectures]
        summary = f"{len(lectures)} lectures" if lectures else "Course"
        if names:
            summary += ": " + \
                ", ".join(names[:6]) + (", …" if len(names) > 6 else "")
        records = [
            ScrapedRecord(
                external_id=course_id,
                url=f"{BASE}/courses/{course_id}",
                title=title,
                format=ResourceFormat.COURSE,
                description=f"{by}. {summary}." if by else f"{summary}.",
                authors=professors,
                extra={"institute": institute, "lectures": len(
                    lectures), "contentType": course.get("contentType")},
                keywords=" ".join(names),
            )
        ]
        for week, lesson in lectures:
            video = squash(lesson.get("youtube_id"))
            if not re.fullmatch(r"[\w-]{6,20}", video):
                continue
            records.append(
                ScrapedRecord(
                    external_id=f"{course_id}:{lesson.get('id')}",
                    parent_external_id=course_id,
                    url=f"https://www.youtube.com/watch?v={video}",
                    title=lecture_title(lesson["name"], title),
                    format=ResourceFormat.VIDEO,
                    description=(f"{week} of “{title}”" if week and week.lower(
                    ) != title.lower() else f"From “{title}”")
                    + (f" ({by})" if by else "")
                    + " on NPTEL.",
                    authors=professors,
                    thumbnail=f"https://i.ytimg.com/vi/{video}/hqdefault.jpg",
                    extra={"course": title, "week": week},
                    keywords=title,
                )
            )
        return records
