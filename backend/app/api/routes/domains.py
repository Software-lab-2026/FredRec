from collections import defaultdict
from uuid import UUID
from fastapi import APIRouter
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import SessionDep
from app.models import Domain, Topic
from app.schemas.admin import DomainOut

router = APIRouter(prefix="/domains", tags=["domains"])


async def load_domains(session: AsyncSession, *conditions: ColumnElement[bool]) -> list[DomainOut]:
    domains = await session.scalars(select(Domain).where(*conditions).order_by(func.lower(Domain.name)))
    topics: defaultdict[UUID, list[str]] = defaultdict(list)
    for domain_id, name in await session.execute(
        select(Topic.domain_id, Topic.name).order_by(func.lower(Topic.name))
    ):
        topics[domain_id].append(name)
    return [DomainOut(id=d.id, name=d.name, description=d.description, topics=topics[d.id]) for d in domains]


@router.get("")
async def list_domains(session: SessionDep) -> list[DomainOut]:
    return await load_domains(session)
