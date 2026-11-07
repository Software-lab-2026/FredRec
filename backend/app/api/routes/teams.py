import uuid
from datetime import UTC, datetime
from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import ReadyUser, SessionDep
from app.core.validation import clean_email
from app.models import Team, TeamInvite, TeamMember, User, Workspace
from app.models.base import InviteStatus, TeamRole, WorkspaceKind
from app.schemas.teams import (
    InviteIn,
    MemberOut,
    MyInviteOut,
    RoleIn,
    TeamDetailOut,
    TeamIn,
    TeamInviteOut,
    TeamOut,
)
from app.schemas.workspaces import WorkspaceIn, WorkspaceOut
from app.services.workspaces import list_workspaces, name_taken, workspace_out

router = APIRouter(prefix="/teams", tags=["teams"])
invites_router = APIRouter(prefix="/invites", tags=["teams"])


async def _membership(session: AsyncSession, team_id: uuid.UUID, user_id: uuid.UUID) -> TeamMember:
    member = await session.get(TeamMember, (team_id, user_id))
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found.")
    return member


async def _owner(session: AsyncSession, team_id: uuid.UUID, user_id: uuid.UUID) -> TeamMember:
    member = await _membership(session, team_id, user_id)
    if member.role != TeamRole.OWNER:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Only team owners can do that.")
    return member


async def _owner_count(session: AsyncSession, team_id: uuid.UUID) -> int:
    return await session.scalar(
        select(func.count()).where(TeamMember.team_id ==
                                   team_id, TeamMember.role == TeamRole.OWNER)
    )


async def _teams_out(session: AsyncSession, user_id: uuid.UUID, *conditions) -> list[TeamOut]:
    counts = (
        select(TeamMember.team_id, func.count().label("n")
               ).group_by(TeamMember.team_id).subquery()
    )
    rows = await session.execute(
        select(Team, TeamMember.role, counts.c.n)
        .join(TeamMember, (TeamMember.team_id == Team.id) & (TeamMember.user_id == user_id))
        .join(counts, counts.c.team_id == Team.id)
        .where(*conditions)
        .order_by(func.lower(Team.name))
    )
    return [
        TeamOut(id=t.id, name=t.name, my_role=role, member_count=n, created_at=t.created_at) for t, role, n in rows
    ]


async def _detail(session: AsyncSession, team_id: uuid.UUID, user_id: uuid.UUID) -> TeamDetailOut:
    team = (await _teams_out(session, user_id, Team.id == team_id))[0]
    members = [
        MemberOut(user_id=m.user_id, username=username,
                  role=m.role, joined_at=m.joined_at)
        for m, username in await session.execute(
            select(TeamMember, User.username)
            .join(User, User.id == TeamMember.user_id)
            .where(TeamMember.team_id == team_id)
            .order_by(TeamMember.joined_at)
        )
    ]
    invites: list[TeamInviteOut] = []
    if team.my_role == TeamRole.OWNER:
        invites = [
            TeamInviteOut(id=i.id, invitee=username or i.email,
                          role=i.role, created_at=i.created_at)
            for i, username in await session.execute(
                select(TeamInvite, User.username)
                .outerjoin(User, User.id == TeamInvite.invited_user_id)
                .where(TeamInvite.team_id == team_id, TeamInvite.status == InviteStatus.PENDING)
                .order_by(TeamInvite.created_at)
            )
        ]
    workspaces = await list_workspaces(session, user_id, Workspace.team_id == team_id)
    return TeamDetailOut(**team.model_dump(), members=members, invites=invites, workspaces=workspaces)


@router.get("")
async def my_teams(user: ReadyUser, session: SessionDep) -> list[TeamOut]:
    return await _teams_out(session, user.id)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_team(body: TeamIn, user: ReadyUser, session: SessionDep) -> TeamDetailOut:
    team = Team(name=body.name, created_by=user.id)
    session.add(team)
    await session.flush()
    session.add(TeamMember(team_id=team.id,
                user_id=user.id, role=TeamRole.OWNER))
    await session.commit()
    return await _detail(session, team.id, user.id)


@router.get("/{team_id}")
async def team_detail(team_id: uuid.UUID, user: ReadyUser, session: SessionDep) -> TeamDetailOut:
    await _membership(session, team_id, user.id)
    return await _detail(session, team_id, user.id)


@router.patch("/{team_id}")
async def rename_team(team_id: uuid.UUID, body: TeamIn, user: ReadyUser, session: SessionDep) -> TeamDetailOut:
    await _owner(session, team_id, user.id)
    (await session.get(Team, team_id)).name = body.name
    await session.commit()
    return await _detail(session, team_id, user.id)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(team_id: uuid.UUID, user: ReadyUser, session: SessionDep) -> Response:
    await _owner(session, team_id, user.id)
    await session.delete(await session.get(Team, team_id))
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{team_id}/members/{member_id}")
async def change_role(
    team_id: uuid.UUID, member_id: uuid.UUID, body: RoleIn, user: ReadyUser, session: SessionDep
) -> TeamDetailOut:
    await _owner(session, team_id, user.id)
    member = await session.get(TeamMember, (team_id, member_id))
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found.")
    if member.role == TeamRole.OWNER and body.role != TeamRole.OWNER and await _owner_count(session, team_id) == 1:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "A team needs at least one owner. Make someone else owner first.")
    member.role = body.role
    await session.commit()
    return await _detail(session, team_id, user.id)


@router.delete("/{team_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(team_id: uuid.UUID, member_id: uuid.UUID, user: ReadyUser, session: SessionDep) -> Response:
    me = await _membership(session, team_id, user.id)
    if member_id != user.id and me.role != TeamRole.OWNER:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Only team owners can do that.")
    member = await session.get(TeamMember, (team_id, member_id))
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found.")
    if member.role == TeamRole.OWNER and await _owner_count(session, team_id) == 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "A team needs at least one owner. Make someone else owner, or delete the team."
        )
    await session.delete(member)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{team_id}/invites", status_code=status.HTTP_201_CREATED)
async def invite(team_id: uuid.UUID, body: InviteIn, user: ReadyUser, session: SessionDep) -> TeamDetailOut:
    await _owner(session, team_id, user.id)
    target = body.invitee.strip()
    email: str | None = None
    if "@" in target:
        try:
            email = clean_email(target)
        except ValueError as e:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, str(e)) from e
        invitee = await session.scalar(select(User).where(func.lower(User.email) == email.lower()))
    else:
        invitee = await session.scalar(select(User).where(func.lower(User.username) == target.lower()))
        if invitee is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND,
                                f"There's no user called “{target}”.")
    if invitee is not None:
        if invitee.id == user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                "You're already in this team.")
        if await session.get(TeamMember, (team_id, invitee.id)):
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"@{invitee.username} is already in this team.")
    session.add(
        TeamInvite(
            team_id=team_id,
            invited_user_id=invitee.id if invitee else None,
            email=None if invitee else email,
            role=body.role,
            invited_by=user.id,
        )
    )
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "They already have a pending invite to this team.") from e
    return await _detail(session, team_id, user.id)


@router.delete("/{team_id}/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(team_id: uuid.UUID, invite_id: uuid.UUID, user: ReadyUser, session: SessionDep) -> Response:
    await _owner(session, team_id, user.id)
    invite_row = await session.get(TeamInvite, invite_id)
    if invite_row is None or invite_row.team_id != team_id or invite_row.status != InviteStatus.PENDING:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found.")
    invite_row.status, invite_row.responded_at = InviteStatus.REVOKED, datetime.now(
        UTC)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _addressed_to(user: User):
    return or_(TeamInvite.invited_user_id == user.id, func.lower(TeamInvite.email) == user.email.lower())


@invites_router.get("")
async def my_invites(user: ReadyUser, session: SessionDep) -> list[MyInviteOut]:
    inviter = select(User.username).where(
        User.id == TeamInvite.invited_by).scalar_subquery()
    rows = await session.execute(
        select(TeamInvite, Team.name, inviter)
        .join(Team, Team.id == TeamInvite.team_id)
        .where(_addressed_to(user), TeamInvite.status == InviteStatus.PENDING)
        .order_by(TeamInvite.created_at)
    )
    return [
        MyInviteOut(
            id=i.id, team_id=i.team_id, team_name=name, role=i.role, invited_by=by, created_at=i.created_at
        )
        for i, name, by in rows
    ]


async def _my_pending_invite(session: AsyncSession, invite_id: uuid.UUID, user: User) -> TeamInvite:
    invite_row = await session.scalar(
        select(TeamInvite).where(
            TeamInvite.id == invite_id, _addressed_to(
                user), TeamInvite.status == InviteStatus.PENDING
        )
    )
    if invite_row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found.")
    return invite_row


@invites_router.post("/{invite_id}/accept")
async def accept(invite_id: uuid.UUID, user: ReadyUser, session: SessionDep) -> TeamDetailOut:
    invite_row = await _my_pending_invite(session, invite_id, user)
    invite_row.status, invite_row.responded_at = InviteStatus.ACCEPTED, datetime.now(
        UTC)
    if await session.get(TeamMember, (invite_row.team_id, user.id)) is None:
        session.add(TeamMember(team_id=invite_row.team_id,
                    user_id=user.id, role=invite_row.role))
    await session.commit()
    return await _detail(session, invite_row.team_id, user.id)


@invites_router.post("/{invite_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline(invite_id: uuid.UUID, user: ReadyUser, session: SessionDep) -> Response:
    invite_row = await _my_pending_invite(session, invite_id, user)
    invite_row.status, invite_row.responded_at = InviteStatus.DECLINED, datetime.now(
        UTC)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{team_id}/workspaces", status_code=status.HTTP_201_CREATED)
async def create_team_workspace(
    team_id: uuid.UUID, body: WorkspaceIn, user: ReadyUser, session: SessionDep
) -> WorkspaceOut:
    await _owner(session, team_id, user.id)
    workspace = Workspace(
        name=body.name, kind=WorkspaceKind.TEAM, team_id=team_id)
    session.add(workspace)
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise name_taken(True, body.name) from e
    return await workspace_out(session, workspace.id, user.id)
