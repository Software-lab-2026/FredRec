import uuid
from collections import Counter
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Progress, Team, TeamMember, Workspace, WorkspaceItem
from app.models.base import ProgressStatus, TeamRole
from app.schemas.workspaces import Access, TeamRef, WorkspaceOut

RANK: dict[str, int] = {"viewer": 0, "editor": 1, "owner": 2}


async def access_to(session: AsyncSession, workspace: Workspace, user_id: uuid.UUID) -> Access | None:
    if workspace.owner_user_id is not None:
        return "owner" if workspace.owner_user_id == user_id else None
    role = await session.scalar(
        select(TeamMember.role).where(TeamMember.team_id ==
                                      workspace.team_id, TeamMember.user_id == user_id)
    )
    return role.value if role else None


async def get_workspace(
    session: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID, need: Access
) -> tuple[Workspace, Access]:
    workspace = await session.get(Workspace, workspace_id)
    access = await access_to(session, workspace, user_id) if workspace else None
    if access is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found.")
    if RANK[access] < RANK[need]:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "You don't have permission to do that.")
    return workspace, access


async def list_workspaces(
    session: AsyncSession, user_id: uuid.UUID, *conditions, min_access: Access = "viewer"
) -> list[WorkspaceOut]:
    mine = select(TeamMember.team_id, TeamMember.role).where(
        TeamMember.user_id == user_id).subquery()
    rows = (
        await session.execute(
            select(Workspace, Team.name, mine.c.role)
            .outerjoin(Team, Team.id == Workspace.team_id)
            .outerjoin(mine, mine.c.team_id == Workspace.team_id)
            .where(or_(Workspace.owner_user_id == user_id, mine.c.team_id.is_not(None)), *conditions)
            .order_by(Workspace.created_at)
        )
    ).all()
    ids = [w.id for w, _, _ in rows]
    items: Counter[uuid.UUID] = Counter()
    done: Counter[uuid.UUID] = Counter()
    if ids:
        items.update(
            dict(
                (await session.execute(
                    select(WorkspaceItem.workspace_id, func.count())
                    .where(WorkspaceItem.workspace_id.in_(ids))
                    .group_by(WorkspaceItem.workspace_id)
                )).all()
            )
        )
        done.update(
            dict(
                (await session.execute(
                    select(WorkspaceItem.workspace_id, func.count())
                    .join(
                        Progress,
                        (Progress.resource_id == WorkspaceItem.resource_id) & (
                            Progress.user_id == user_id),
                    )
                    .where(WorkspaceItem.workspace_id.in_(ids), Progress.status == ProgressStatus.COMPLETED)
                    .group_by(WorkspaceItem.workspace_id)
                )).all()
            )
        )
    result = []
    for w, team_name, role in rows:
        access: Access = "owner" if w.owner_user_id == user_id else TeamRole(
            role).value
        if RANK[access] < RANK[min_access]:
            continue
        result.append(
            WorkspaceOut(
                id=w.id,
                name=w.name,
                created_at=w.created_at,
                item_count=items[w.id],
                completed_count=done[w.id],
                team=TeamRef(
                    id=w.team_id, name=team_name) if w.team_id else None,
                access=access,
            )
        )
    return result


async def workspace_out(session: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID) -> WorkspaceOut:
    return (await list_workspaces(session, user_id, Workspace.id == workspace_id))[0]


def name_taken(team: bool, name: str) -> HTTPException:
    owner = "This team already has" if team else "You already have"
    return HTTPException(status.HTTP_409_CONFLICT, f"{owner} a workspace called “{name}”.")
