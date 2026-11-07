import uuid
from datetime import datetime
from typing import Annotated
from pydantic import AfterValidator, Field
from app.core.validation import clean_name
from app.models.base import TeamRole
from app.schemas.auth import ApiModel
from app.schemas.workspaces import WorkspaceOut

Name = Annotated[str, AfterValidator(clean_name)]


class TeamIn(ApiModel):
    name: Name


class TeamOut(ApiModel):
    id: uuid.UUID
    name: str
    my_role: TeamRole
    member_count: int
    created_at: datetime


class MemberOut(ApiModel):
    user_id: uuid.UUID
    username: str
    role: TeamRole
    joined_at: datetime


class TeamInviteOut(ApiModel):
    id: uuid.UUID
    invitee: str
    role: TeamRole
    created_at: datetime


class TeamDetailOut(TeamOut):
    members: list[MemberOut]
    invites: list[TeamInviteOut]
    workspaces: list[WorkspaceOut]


class InviteIn(ApiModel):
    invitee: Annotated[str, Field(min_length=1, max_length=320)]
    role: TeamRole = TeamRole.VIEWER


class RoleIn(ApiModel):
    role: TeamRole


class MyInviteOut(ApiModel):
    id: uuid.UUID
    team_id: uuid.UUID
    team_name: str
    role: TeamRole
    invited_by: str
    created_at: datetime
