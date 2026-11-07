import uuid
from datetime import datetime
from typing import Annotated, Literal
from pydantic import AfterValidator
from app.core.validation import clean_name
from app.models.base import ProgressStatus
from app.schemas.auth import ApiModel
from app.schemas.resources import ResourceIn, ResourceOut

Access = Literal["owner", "editor", "viewer"]
Name = Annotated[str, AfterValidator(clean_name)]


class TeamRef(ApiModel):
    id: uuid.UUID
    name: str


class WorkspaceIn(ApiModel):
    name: Name


class WorkspaceOut(ApiModel):
    id: uuid.UUID
    name: str
    created_at: datetime
    item_count: int
    completed_count: int
    team: TeamRef | None = None
    access: Access


class WorkspaceItemOut(ApiModel):
    resource: ResourceOut
    added_at: datetime
    status: ProgressStatus
    percent: int


class WorkspaceDetailOut(ApiModel):
    workspace: WorkspaceOut
    items: list[WorkspaceItemOut]


class AddItemIn(ApiModel):
    resource: ResourceIn
