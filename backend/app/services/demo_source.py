import re
from urllib.parse import quote_plus

from app.models.base import Difficulty, ResourceFormat
from app.schemas.resources import ResourceOut
from app.services.urls import normalize_url

D, F = Difficulty, ResourceFormat

TEMPLATES = [
    (F.VIDEO, "YouTube", ["freeCodeCamp.org"], 480, None, D.BEGINNER, 2024, "{t} – Full Course for Beginners",
     "https://www.youtube.com/results?search_query={q}+full+course",
     "A complete, beginner-friendly walkthrough of {t} with hands-on examples."),
    (F.VIDEO, "YouTube", ["MIT OpenCourseWare"], 75, None, D.INTERMEDIATE, 2022, "Lecture 1: Introduction to {t}",
     "https://www.youtube.com/results?search_query={q}+mit+lecture",
     "University lecture introducing the core concepts of {t}."),
    (F.COURSE, "Coursera", ["Stanford University"], 30 * 60, None, D.BEGINNER, 2023, "{t} Specialization (free to audit)",
     "https://www.coursera.org/search?query={q}&isFree=true", "Audit all videos and readings for {t} for free."),
    (F.PAPER, "arXiv", ["A. Sharma", "L. Chen"], None, 24, D.ADVANCED, 2025, "A Survey of Recent Advances in {t}",
     "https://arxiv.org/search/?query={q}&searchtype=all",
     "Comprehensive survey covering foundations and open problems in {t}."),
    (F.PAPER, "OpenAlex", ["R. Gupta"], None, 12, D.ADVANCED, 2020, "{t}: Foundations and Applications",
     "https://openalex.org/works?search={q}", "Highly cited open-access paper on {t}."),
    (F.TEXTBOOK, "OpenStax", ["OpenStax"], None, 620, D.BEGINNER, 2022, "Introduction to {t}",
     "https://openstax.org/search?q={q}", "Peer-reviewed, openly licensed textbook on {t}."),
    (F.TEXTBOOK, "Open Library", ["Various"], None, 450, D.INTERMEDIATE, 2019, "{t}: Principles and Practice",
     "https://openlibrary.org/search?q={q}&mode=everything", "Borrowable digital textbook covering {t}."),
    (F.ARTICLE, "GeeksforGeeks", ["GeeksforGeeks"], None, None, D.BEGINNER, 2025, "{t} Tutorial",
     "https://www.geeksforgeeks.org/search/?gq={q}",
     "Step-by-step tutorial on {t} with code examples and practice problems."),
    (F.ARTICLE, "dev.to", ["Community"], None, None, D.INTERMEDIATE, 2025, "What I wish I knew before learning {t}",
     "https://dev.to/search?q={q}", "Practical tips and common pitfalls when studying {t}."),
    (F.REPO, "GitHub", ["Open source"], None, None, D.INTERMEDIATE, 2025, "awesome-{slug}",
     "https://github.com/search?q=awesome+{q}&type=repositories",
     "Curated list of free {t} resources, books and projects."),
]


def demo_results(topic: str) -> list[ResourceOut]:
    q = quote_plus(topic)
    slug = re.sub(r"\s+", "-", topic.lower())
    results = []
    for fmt, source, authors, minutes, pages, difficulty, year, title, url, description in TEMPLATES:
        url = url.format(q=q)
        results.append(
            ResourceOut(
                url=url,
                url_hash=normalize_url(url)[1],
                title=title.format(t=topic, slug=slug),
                format=fmt,
                source=source,
                description=description.format(t=topic),
                authors=authors,
                duration_minutes=minutes,
                pages=pages,
                difficulty=difficulty,
                published_year=year,
            )
        )
    return results
