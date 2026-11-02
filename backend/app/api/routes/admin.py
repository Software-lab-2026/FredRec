from collections import defaultdict
from uuid import UUID
from typing import Annotated
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, SessionDep
from app.api.routes.auth import account_conflict
from app.api.routes.domains import load_domains
from app.core.security import hash_password
from app.models import Domain, DomainExpert, Topic, User
from app.models.base import Role
from app.schemas.admin import (
    DomainCreateIn,
    DomainOut,
    DomainRenameIn,
    ExpertCreateIn,
    ExpertOut,
    ExpertUpdateIn,
    TopicCreateIn,
)

router = APIRouter(prefix="/admin", tags=["admin"])


async def _domain_out(session: AsyncSession, domain_id: UUID) -> DomainOut:
    return (await load_domains(session, Domain.id == domain_id))[0]


async def _get_domain(session: AsyncSession, domain_id: UUID) -> Domain:
    domain = await session.get(Domain, domain_id)
    if domain is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Domain not found.")
    return domain


def _domain_name_taken(name: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, f"A domain called “{name}” already exists.")


@router.post("/domains", status_code=status.HTTP_201_CREATED)
async def create_domain(body: DomainCreateIn, admin: AdminUser, session: SessionDep) -> DomainOut:
    domain = Domain(
        name=body.name, description=body.description.strip(), created_by=admin.id)
    session.add(domain)
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise _domain_name_taken(body.name) from e
    return await _domain_out(session, domain.id)


@router.patch("/domains/{domain_id}")
async def rename_domain(domain_id: UUID, body: DomainRenameIn, _admin: AdminUser, session: SessionDep) -> DomainOut:
    domain = await _get_domain(session, domain_id)
    domain.name = body.name
    try:
        await session.flush()
    except IntegrityError as e:
        await session.rollback()
        raise _domain_name_taken(body.name) from e
    await session.commit()
    return await _domain_out(session, domain_id)


# @router.post("/domains/{domain_id}/topics", status_code=status.HTTP_201_CREATED)
# async def add_topic(domain_id: UUID, body: TopicCreateIn, _admin: AdminUser, session: SessionDep) -> DomainOut:
#     await _get_domain(session, domain_id)
#     owner = await session.scalar(
#         select(Domain.name).join(Topic, Topic.domain_id == Domain.id).where(
#             func.lower(Topic.name) == body.name.lower())
#     )
#     if owner is not None:
#         raise HTTPException(status.HTTP_409_CONFLICT, f"“{
#                             body.name}” already exists in {owner}.")
#     topic = Topic(domain_id=domain_id, name=body.name,
#                   description=body.description.strip())
#     session.add(topic)
#     try:
#         await session.flush()
#     except IntegrityError as e:
#         await session.rollback()
#         raise HTTPException(status.HTTP_409_CONFLICT, f"“{
#                             body.name}” already exists.") from e
#     await embed_topics(session, [topic])
#     await session.commit()
#     return await _domain_out(session, domain_id)


async def _experts_out(session: AsyncSession, *conditions) -> list[ExpertOut]:
    experts = await session.scalars(
        select(User).where(User.role == Role.EXPERT, *
                           conditions).order_by(func.lower(User.username))
    )
    domains: defaultdict[UUID, list[UUID]] = defaultdict(list)
    for user_id, domain_id in await session.execute(select(DomainExpert.user_id, DomainExpert.domain_id)):
        domains[user_id].append(domain_id)
    return [
        ExpertOut(
            id=x.id,
            username=x.username,
            email=x.email,
            domain_ids=domains[x.id],
            is_active=x.is_active,
            must_change_password=x.must_change_password,
        )
        for x in experts
    ]


async def _check_domains_exist(session: AsyncSession, domain_ids: list[UUID]) -> None:
    found = set(await session.scalars(select(Domain.id).where(Domain.id.in_(domain_ids))))
    if found != set(domain_ids):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown domain.")


@router.get("/experts")
async def list_experts(_admin: AdminUser, session: SessionDep) -> list[ExpertOut]:
    return await _experts_out(session)


@router.post("/experts", status_code=status.HTTP_201_CREATED)
async def create_expert(body: ExpertCreateIn, admin: AdminUser, session: SessionDep) -> ExpertOut:
    await _check_domains_exist(session, body.domain_ids)
    expert = User(
        username=body.username,
        email=body.email,
        password_hash=await run_in_threadpool(hash_password, body.password),
        role=Role.EXPERT,
        must_change_password=True,
        created_by=admin.id,
    )
    session.add(expert)
    try:
        await session.flush()
        session.add_all(DomainExpert(domain_id=d, user_id=expert.id,
                        assigned_by=admin.id) for d in body.domain_ids)
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise account_conflict(e) from e
    return (await _experts_out(session, User.id == expert.id))[0]


@router.patch("/experts/{expert_id}")
async def update_expert(expert_id: UUID, body: ExpertUpdateIn, admin: AdminUser, session: SessionDep) -> ExpertOut:
    expert = await session.scalar(select(User).where(User.id == expert_id, User.role == Role.EXPERT))
    if expert is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expert not found.")
    if body.is_active is not None:
        expert.is_active = body.is_active
    if body.domain_ids is not None:
        await _check_domains_exist(session, body.domain_ids)
        current = {
            row.domain_id: row
            for row in await session.scalars(select(DomainExpert).where(DomainExpert.user_id == expert_id))
        }
        for domain_id, row in current.items():
            if domain_id not in body.domain_ids:
                await session.delete(row)
        session.add_all(
            DomainExpert(domain_id=d, user_id=expert_id, assigned_by=admin.id)
            for d in body.domain_ids
            if d not in current
        )
    await session.commit()
    return (await _experts_out(session, User.id == expert_id))[0]
