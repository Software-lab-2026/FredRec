from typing import Annotated
from pydantic import Field
from app.models.base import Difficulty, ProgressStatus, ResourceFormat, ResourceOrigin
from app.schemas.auth import ApiModel


class ResourceIn(ApiModel):
    url: Annotated[str, Field(min_length=1, max_length=2000)]
    title: Annotated[str, Field(min_length=1, max_length=500)]
    format: ResourceFormat
    source: Annotated[str, Field(max_length=200)] = ""
    description: Annotated[str, Field(max_length=5000)] = ""
    authors: Annotated[list[Annotated[str, Field(
        max_length=200)]], Field(max_length=50)] = []
    thumbnail: Annotated[str | None, Field(max_length=2000)] = None
    duration_minutes: Annotated[int | None, Field(ge=0)] = None
    pages: Annotated[int | None, Field(ge=0)] = None
    published_year: Annotated[int | None, Field(ge=0, le=3000)] = None


class ResourceOut(ApiModel):
    url: str
    url_hash: str
    title: str
    format: ResourceFormat
    source: str
    description: str
    authors: list[str]
    thumbnail: str | None = None
    duration_minutes: int | None = None
    pages: int | None = None
    difficulty: Difficulty | None = None
    published_year: int | None = None
    avg_rating: float | None = None
    review_count: int | None = None
    origin: ResourceOrigin = ResourceOrigin.FETCHED


class ProgressIn(ApiModel):
    status: ProgressStatus
    percent: Annotated[int, Field(ge=0, le=100)]


class ProgressOut(ApiModel):
    status: ProgressStatus
    percent: int


class ReviewIn(ApiModel):
    resource: ResourceIn
    rating: Annotated[int, Field(ge=1, le=5)]
    text: Annotated[str, Field(max_length=2000)] = ""


class RatingOut(ApiModel):
    avg_rating: float
    review_count: int
