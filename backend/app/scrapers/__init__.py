"""Web scrapers for sites without a suitable API. Run with `python -m app.cli scrape <name>`."""

from app.scrapers.base import ScrapedRecord, Scraper
from app.scrapers.mit_ocw import MitOcw
from app.scrapers.nptel import Nptel
from app.scrapers.tycs import TeachYourselfCs

SCRAPERS: dict[str, type[Scraper]] = {s.key: s for s in (Nptel, MitOcw, TeachYourselfCs)}

__all__ = ["SCRAPERS", "ScrapedRecord", "Scraper"]
