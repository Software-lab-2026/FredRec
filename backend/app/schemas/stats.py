from datetime import date
from app.schemas.auth import ApiModel


class DayCount(ApiModel):
    day: date
    matched: int
    unmatched: int


class NameCount(ApiModel):
    name: str
    count: int


class Pipeline(ApiModel):
    waiting_for_expert: int
    waiting_for_admin: int
    published: int
    rejected: int
    median_hours_to_publish: float | None


class AdminTotals(ApiModel):
    learners: int
    experts: int
    published_resources: int
    waiting_for_admin: int
    searches: int
    unmatched_searches: int


class AdminStats(ApiModel):
    days: int
    totals: AdminTotals
    searches_per_day: list[DayCount]
    top_topics: list[NameCount]
    pipeline: Pipeline


class ExpertTotals(ApiModel):
    waiting: int
    my_reviews: int
    concepts: int
    searches: int


class TopicCoverage(ApiModel):
    topic: str
    concepts: int
    published: int


class ExpertStats(ApiModel):
    days: int
    totals: ExpertTotals
    top_searches: list[NameCount]
    topics: list[TopicCoverage]
    difficulty: list[NameCount]
