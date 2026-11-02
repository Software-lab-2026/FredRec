from typing import Annotated
from fastapi import APIRouter, Query
from sqlalchemy import select
from app.api.deps import ExpertUser, SessionDep
from app.api.routes.domains import load_domains
from app.models import Domain, DomainExpert
from app.schemas.admin import DomainOut

router = APIRouter(prefix="/expert", tags=["expert"])


@router.get("/domains")
async def my_domains(user: ExpertUser, session: SessionDep) -> list[DomainOut]:
    mine = select(DomainExpert.domain_id).where(
        DomainExpert.user_id == user.id)
    return await load_domains(session, Domain.id.in_(mine))
