from typing import Annotated
from fastapi import APIRouter, Query
from app.api.deps import SessionDep
from app.models.base import ResourceFormat
from app.schemas.search import SearchOut
from app.services.search import search as run_search

router = APIRouter(tags=["search"])


@router.get("/search", response_model_exclude_none=True)
async def search(
    q: Annotated[str, Query(max_length=200)],
    session: SessionDep,
    format: ResourceFormat | None = None,
    source: Annotated[str | None, Query(max_length=50)] = None,
    min_year: Annotated[int | None, Query(
        ge=1900, le=2100, alias="minYear")] = None,
) -> SearchOut:
    return await run_search(session, q, format=format, source=source, min_year=min_year)
