from typing import Literal
from app.models.base import MatchMethod
from app.schemas.auth import ApiModel
from app.schemas.resources import ResourceOut


class MatchOut(ApiModel):
    kind: Literal["topic", "concept"]
    name: str
    method: MatchMethod
    path: list[str]


class SearchOut(ApiModel):
    query: str
    topic: str
    match: MatchOut
    results: list[ResourceOut]
    related: list[ResourceOut] = []
    suggestions: list[str] = []
    failed_sources: list[str]
    cached: bool
