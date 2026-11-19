from typing import Annotated
from fastapi import APIRouter, Query
from sqlalchemy import select
from app.api.deps import ExpertUser, SessionDep
from app.api.routes.domains import load_domains
from app.models import Domain, DomainExpert
from app.schemas.admin import DomainOut
from app.schemas.stats import ExpertStats
from app.services.stats import expert_stats

router = APIRouter(prefix="/expert", tags=["expert"])


@router.get("/domains")
async def my_domains(user: ExpertUser, session: SessionDep) -> list[DomainOut]:
    mine = select(DomainExpert.domain_id).where(
        DomainExpert.user_id == user.id)
    return await load_domains(session, Domain.id.in_(mine))


@router.get("/stats")
async def stats(user: ExpertUser, session: SessionDep, days: Annotated[int, Query(ge=1, le=90)] = 30) -> ExpertStats:
    return await expert_stats(session, user, days)
