from app.connectors.arxiv import ArXiv
from app.connectors.base import Candidate, Connector
from app.connectors.core import Core
from app.connectors.devto import DevTo
from app.connectors.github import GitHub
from app.connectors.google_books import GoogleBooks
from app.connectors.internet_archive import InternetArchive
from app.connectors.mit_learn import MitLearn
from app.connectors.open_library import OpenLibrary
from app.connectors.openalex import OpenAlex
from app.connectors.semantic_scholar import SemanticScholar
from app.connectors.wikibooks import Wikibooks
from app.connectors.youtube import YouTube

# Every search source. Ones needing a missing key are skipped at search time.
CONNECTORS: list[Connector] = [
    YouTube(),
    MitLearn(),
    ArXiv(),
    OpenAlex(),
    SemanticScholar(),
    Core(),
    OpenLibrary(),
    GoogleBooks(),
    Wikibooks(),
    InternetArchive(),
    DevTo(),
    GitHub(),
]

__all__ = ["CONNECTORS", "Candidate", "Connector"]
