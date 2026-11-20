import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated
from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.db import get_session
from app.api.routes import auth, admin, concepts, domains, expert, search, submissions, workspaces, feedback, teams
from app.core.embeddings import get_embedder


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    settings.jwt_key
    settings.sqlalchemy_url
    warm_up = asyncio.create_task(asyncio.to_thread(get_embedder))
    yield
    warm_up.cancel()


app = FastAPI(title="FredRec API", lifespan=lifespan)
for router in (auth.router, domains.router, expert.router, admin.router, submissions.router, submissions.expert_router, submissions.admin_router, feedback.router, teams.router, teams.invites_router, workspaces.router, concepts.router, search.router):
    app.include_router(router, prefix="/api")


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    message = exc.errors()[0]["msg"].removeprefix("Value error, ")
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": message})


@app.get("/api/health")
async def health(session: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, str]:
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
