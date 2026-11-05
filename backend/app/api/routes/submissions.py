import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from app.api.deps import AdminUser, ExpertUser, ReadyUser, SessionDep
from app.models import Domain, DomainExpert, Resource, ResourceSubmission, SubmissionEvent, Topic, User
from app.models.base import ResourceOrigin, ResourceStatus, Role, SubmissionAction, SubmissionStatus
from app.schemas.submissions import (
    ApproveIn,
    RejectIn,
    SubmissionEventOut,
    SubmissionIn,
    SubmissionOut,
    SubmitterOut,
)
from app.services.resources import url_hash_or_422
from app.services.urls import source_name

router = APIRouter(prefix="/submissions", tags=["submissions"])
expert_router = APIRouter(prefix="/expert", tags=["expert"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])

DAILY_SUGGESTION_LIMIT = 10
ACTIVE_STATUSES = (SubmissionStatus.PENDING_EXPERT,
                   SubmissionStatus.PENDING_ADMIN, SubmissionStatus.PUBLISHED)


def _has_active_expert() -> ColumnElement[bool]:
    expert = aliased(User)
    return (
        select(DomainExpert.user_id)
        .join(expert, expert.id == DomainExpert.user_id)
        .where(
            DomainExpert.domain_id == ResourceSubmission.domain_id,
            expert.is_active.is_(True),
            expert.role == Role.EXPERT,
        )
        .exists()
    )


def _admin_may_review() -> ColumnElement[bool]:
    return (ResourceSubmission.status == SubmissionStatus.PENDING_ADMIN) | (
        (ResourceSubmission.status ==
         SubmissionStatus.PENDING_EXPERT) & ~_has_active_expert()
    )


async def _load(session: AsyncSession, *conditions, order_by=(), flag_no_experts: bool = False) -> list[SubmissionOut]:
    rows = (
        await session.execute(
            select(ResourceSubmission, Topic.name, User.username)
            .join(Topic, Topic.id == ResourceSubmission.topic_id)
            .join(User, User.id == ResourceSubmission.submitted_by)
            .where(*conditions)
            .order_by(*order_by)
        )
    ).all()
    events: defaultdict[uuid.UUID,
                        list[SubmissionEventOut]] = defaultdict(list)
    if rows:
        for event, actor in await session.execute(
            select(SubmissionEvent, User.username)
            .join(User, User.id == SubmissionEvent.actor_id)
            .where(SubmissionEvent.submission_id.in_([s.id for s, _, _ in rows]))
            .order_by(SubmissionEvent.created_at)
        ):
            events[event.submission_id].append(
                SubmissionEventOut(
                    action=event.action, actor=actor, note=event.note, at=event.created_at)
            )
    return [
        SubmissionOut(
            id=s.id,
            url=s.url,
            url_hash=s.url_hash,
            title=s.title,
            description=s.description,
            format=s.format,
            domain_id=s.domain_id,
            topic=topic,
            suggested_difficulty=s.suggested_difficulty,
            difficulty=s.difficulty,
            status=s.status,
            submitted_by=SubmitterOut(id=s.submitted_by, username=username),
            created_at=s.created_at,
            published_at=s.admin_reviewed_at
            if s.status in (SubmissionStatus.PUBLISHED, SubmissionStatus.ARCHIVED)
            else None,
            events=events[s.id],
            no_active_experts=(
                s.status == SubmissionStatus.PENDING_EXPERT) if flag_no_experts else None,
        )
        for s, topic, username in rows
    ]


async def _one(session: AsyncSession, submission_id: uuid.UUID) -> SubmissionOut:
    return (await _load(session, ResourceSubmission.id == submission_id))[0]


async def _lock(session: AsyncSession, submission_id: uuid.UUID) -> ResourceSubmission:
    submission = await session.scalar(
        select(ResourceSubmission).where(
            ResourceSubmission.id == submission_id).with_for_update()
    )
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found.")
    return submission


async def _topic_in_domain(session: AsyncSession, domain_id: uuid.UUID, topic: str) -> Topic:
    domain = await session.get(Domain, domain_id)
    if domain is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown domain.")
    found = await session.scalar(
        select(Topic).where(Topic.domain_id == domain_id,
                            func.lower(Topic.name) == topic.strip().lower())
    )
    if found is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            f"Pick a topic from {domain.name}.")
    return found


async def _is_expert_in(session: AsyncSession, user: User, domain_id: uuid.UUID) -> bool:
    if user.role != Role.EXPERT:
        return False
    return (
        await session.scalar(
            select(DomainExpert.user_id).where(DomainExpert.user_id ==
                                               user.id, DomainExpert.domain_id == domain_id)
        )
        is not None
    )


def _event(session: AsyncSession, submission_id: uuid.UUID, actor: User, action: SubmissionAction, note: str = ""):
    session.add(
        SubmissionEvent(submission_id=submission_id, actor_id=actor.id,
                        action=action, note=note.strip() or None)
    )


async def _publish(session: AsyncSession, s: ResourceSubmission, now: datetime) -> uuid.UUID:
    curated = {
        "title": s.title,
        "format": s.format,
        "description": s.description,
        "difficulty": s.difficulty,
        "topic_id": s.topic_id,
        "origin": ResourceOrigin.CURATED,
        "status": ResourceStatus.ACTIVE,
        "published_at": now,
    }
    resource_id = await session.scalar(
        insert(Resource)
        .values(id=uuid.uuid4(), url=s.url, url_hash=s.url_hash, source=source_name(s.url), first_added_by=s.submitted_by, **curated)
        .on_conflict_do_update(index_elements=[Resource.url_hash], set_={**curated, "updated_at": func.now()})
        .returning(Resource.id)
    )
    resource = await session.get(Resource, resource_id, populate_existing=True)
    return resource_id


def _apply_review(s: ResourceSubmission, body: ApproveIn, topic: Topic) -> None:
    s.title = body.title
    s.format = body.format
    s.topic_id = topic.id
    s.difficulty = body.difficulty


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_submission(body: SubmissionIn, user: ReadyUser, session: SessionDep) -> SubmissionOut:
    url_hash = url_hash_or_422(body.url)
    topic = await _topic_in_domain(session, body.domain_id, body.topic)

    existing = await session.scalar(
        select(ResourceSubmission.status).where(
            ResourceSubmission.url_hash == url_hash, ResourceSubmission.status.in_(
                ACTIVE_STATUSES)
        )
    )
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This resource is already on FredRec."
            if existing == SubmissionStatus.PUBLISHED
            else "Resource under review.",
        )

    is_admin = user.role == Role.ADMIN
    if not is_admin:
        recent = await session.scalar(
            select(func.count()).where(
                ResourceSubmission.submitted_by == user.id,
                ResourceSubmission.created_at > func.now() - timedelta(days=1),
            )
        )
        if recent >= DAILY_SUGGESTION_LIMIT:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"You can suggest up to {
                    DAILY_SUGGESTION_LIMIT} resources a day. Try again tomorrow.",
            )

    is_domain_expert = await _is_expert_in(session, user, body.domain_id)
    sets_difficulty = is_admin or is_domain_expert
    if sets_difficulty and body.difficulty is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Set the difficulty level.")

    now = datetime.now(UTC)
    s = ResourceSubmission(
        url=body.url.strip(),
        url_hash=url_hash,
        title=body.title,
        description=body.description.strip(),
        format=body.format,
        domain_id=body.domain_id,
        topic_id=topic.id,
        suggested_difficulty=None if sets_difficulty else body.difficulty,
        difficulty=body.difficulty if sets_difficulty else None,
        submitted_by=user.id,
        status=SubmissionStatus.PENDING_ADMIN if is_domain_expert else SubmissionStatus.PENDING_EXPERT,
    )
    if is_admin:
        s.resource_id = await _publish(session, s, now)
        s.status = SubmissionStatus.PUBLISHED
        s.admin_reviewer_id = user.id
        s.admin_reviewed_at = now
    session.add(s)
    try:
        await session.flush()
    except IntegrityError as e:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "resources already suggester.") from e
    action = (
        SubmissionAction.ADDED
        if is_admin
        else SubmissionAction.REQUESTED
        if is_domain_expert
        else SubmissionAction.SUGGESTED
    )
    _event(session, s.id, user, action)
    await session.commit()
    return await _one(session, s.id)


@router.get("/mine")
async def my_submissions(user: ReadyUser, session: SessionDep) -> list[SubmissionOut]:
    return await _load(
        session, ResourceSubmission.submitted_by == user.id, order_by=(ResourceSubmission.created_at.desc(),)
    )


@expert_router.get("/queue")
async def expert_queue(user: ExpertUser, session: SessionDep) -> list[SubmissionOut]:
    my_domains = select(DomainExpert.domain_id).where(
        DomainExpert.user_id == user.id)
    return await _load(
        session,
        ResourceSubmission.status == SubmissionStatus.PENDING_EXPERT,
        ResourceSubmission.domain_id.in_(my_domains),
        order_by=(ResourceSubmission.created_at,),
    )


async def _expert_reviewable(session: AsyncSession, user: User, submission_id: uuid.UUID) -> ResourceSubmission:
    s = await _lock(session, submission_id)
    if not await _is_expert_in(session, user, s.domain_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "This suggestion is outside your domains.")
    if s.status != SubmissionStatus.PENDING_EXPERT:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This suggestion has already been reviewed.")
    return s


@expert_router.post("/submissions/{submission_id}/approve")
async def expert_approve(
    submission_id: uuid.UUID, body: ApproveIn, user: ExpertUser, session: SessionDep
) -> SubmissionOut:
    s = await _expert_reviewable(session, user, submission_id)
    _apply_review(s, body, await _topic_in_domain(session, s.domain_id, body.topic))
    s.status = SubmissionStatus.PENDING_ADMIN
    s.expert_reviewer_id, s.expert_note, s.expert_reviewed_at = user.id, body.note.strip(
    ) or None, datetime.now(UTC)
    _event(session, s.id, user, SubmissionAction.EXPERT_APPROVED, body.note)
    await session.commit()
    return await _one(session, s.id)


@expert_router.post("/submissions/{submission_id}/reject")
async def expert_reject(submission_id: uuid.UUID, body: RejectIn, user: ExpertUser, session: SessionDep) -> SubmissionOut:
    s = await _expert_reviewable(session, user, submission_id)
    s.status = SubmissionStatus.REJECTED
    s.expert_reviewer_id, s.expert_note, s.expert_reviewed_at = user.id, body.reason, datetime.now(
        UTC)
    _event(session, s.id, user, SubmissionAction.EXPERT_REJECTED, body.reason)
    await session.commit()
    return await _one(session, s.id)


@admin_router.get("/queue")
async def admin_queue(_admin: AdminUser, session: SessionDep) -> list[SubmissionOut]:
    return await _load(session, _admin_may_review(), order_by=(ResourceSubmission.created_at,), flag_no_experts=True)


async def _admin_reviewable(session: AsyncSession, submission_id: uuid.UUID) -> ResourceSubmission:
    s = await _lock(session, submission_id)
    eligible = await session.scalar(select(_admin_may_review()).where(ResourceSubmission.id == submission_id))
    if not eligible:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This submission isn't waiting for the admin.")
    return s


@admin_router.post("/submissions/{submission_id}/approve")
async def admin_approve(submission_id: uuid.UUID, body: ApproveIn, admin: AdminUser, session: SessionDep) -> SubmissionOut:
    s = await _admin_reviewable(session, submission_id)
    _apply_review(s, body, await _topic_in_domain(session, s.domain_id, body.topic))
    now = datetime.now(UTC)
    s.resource_id = await _publish(session, s, now)
    s.status = SubmissionStatus.PUBLISHED
    s.admin_reviewer_id, s.admin_note, s.admin_reviewed_at = admin.id, body.note.strip() or None, now
    _event(session, s.id, admin, SubmissionAction.ADMIN_APPROVED, body.note)
    await session.commit()
    return await _one(session, s.id)


@admin_router.post("/submissions/{submission_id}/reject")
async def admin_reject(submission_id: uuid.UUID, body: RejectIn, admin: AdminUser, session: SessionDep) -> SubmissionOut:
    s = await _admin_reviewable(session, submission_id)
    s.status = SubmissionStatus.REJECTED
    s.admin_reviewer_id, s.admin_note, s.admin_reviewed_at = admin.id, body.reason, datetime.now(
        UTC)
    _event(session, s.id, admin, SubmissionAction.ADMIN_REJECTED, body.reason)
    await session.commit()
    return await _one(session, s.id)


@admin_router.get("/curated")
async def curated_resources(_admin: AdminUser, session: SessionDep) -> list[SubmissionOut]:
    return await _load(
        session,
        ResourceSubmission.status.in_(
            (SubmissionStatus.PUBLISHED, SubmissionStatus.ARCHIVED)),
        order_by=(ResourceSubmission.admin_reviewed_at.desc(),),
    )


@admin_router.post("/submissions/{submission_id}/archive")
async def archive(submission_id: uuid.UUID, admin: AdminUser, session: SessionDep) -> SubmissionOut:
    s = await _lock(session, submission_id)
    if s.status != SubmissionStatus.PUBLISHED:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Only published resources can be archived.")
    s.status = SubmissionStatus.ARCHIVED
    resource = await session.get(Resource, s.resource_id)
    resource.status = ResourceStatus.ARCHIVED
    _event(session, s.id, admin, SubmissionAction.ARCHIVED)
    await session.commit()
    return await _one(session, s.id)
