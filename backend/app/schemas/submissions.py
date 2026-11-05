import uuid
from datetime import datetime
from typing import Annotated
from pydantic import AfterValidator, Field
from app.models.base import Difficulty, ResourceFormat, SubmissionAction, SubmissionStatus
from app.schemas.auth import ApiModel


def _title(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Add a title.")
    if len(value) > 200:
        raise ValueError("Keep the title under 200 characters.")
    return value


def _reason(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Add a reason so the submitter knows why.")
    return value


Title = Annotated[str, AfterValidator(_title)]
Note = Annotated[str, Field(max_length=500)]


class SubmissionIn(ApiModel):
    url: Annotated[str, Field(min_length=1, max_length=2000)]
    title: Title
    description: Note = ""
    format: ResourceFormat
    domain_id: uuid.UUID
    topic: Annotated[str, Field(min_length=1, max_length=60)]
    difficulty: Difficulty | None = None


class ApproveIn(ApiModel):
    title: Title
    format: ResourceFormat
    topic: Annotated[str, Field(min_length=1, max_length=60)]
    difficulty: Difficulty
    note: Note = ""


class RejectIn(ApiModel):
    reason: Annotated[str, Field(max_length=500), AfterValidator(_reason)]


class SubmitterOut(ApiModel):
    id: uuid.UUID
    username: str


class SubmissionEventOut(ApiModel):
    action: SubmissionAction
    actor: str
    note: str | None = None
    at: datetime


class SubmissionOut(ApiModel):
    id: uuid.UUID
    url: str
    url_hash: str
    title: str
    description: str
    format: ResourceFormat
    domain_id: uuid.UUID
    topic: str
    suggested_difficulty: Difficulty | None = None
    difficulty: Difficulty | None = None
    status: SubmissionStatus
    submitted_by: SubmitterOut
    created_at: datetime
    published_at: datetime | None = None
    events: list[SubmissionEventOut]
    no_active_experts: bool | None = None
