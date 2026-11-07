import uuid
from fastapi import APIRouter, Response, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from app.api.deps import ReadyUser, SessionDep
from app.models import Progress, Resource, Workspace, WorkspaceItem
from app.models.base import ProgressStatus, WorkspaceKind
from app.schemas.resources import ResourceOut
from app.schemas.workspaces import AddItemIn, WorkspaceDetailOut, WorkspaceIn, WorkspaceItemOut, WorkspaceOut
from app.services.resources import resource_out, upsert_resource
from app.services.workspaces import get_workspace, list_workspaces, name_taken, workspace_out

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("")
async def my_workspaces(user: ReadyUser, session: SessionDep) -> list[WorkspaceOut]:
    return await list_workspaces(session, user.id)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workspace(body: WorkspaceIn, user: ReadyUser, session: SessionDep) -> WorkspaceOut:
    workspace = Workspace(
        name=body.name, kind=WorkspaceKind.PERSONAL, owner_user_id=user.id)
    session.add(workspace)
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise name_taken(False, body.name) from e
    return await workspace_out(session, workspace.id, user.id)


@router.get("/saved-index")
async def saved_index(user: ReadyUser, session: SessionDep) -> dict[str, list[uuid.UUID]]:
    editable = [w.id for w in await list_workspaces(session, user.id, min_access="editor")]
    index: dict[str, list[uuid.UUID]] = {}
    if editable:
        for url_hash, workspace_id in await session.execute(
            select(Resource.url_hash, WorkspaceItem.workspace_id)
            .join(WorkspaceItem, WorkspaceItem.resource_id == Resource.id)
            .where(WorkspaceItem.workspace_id.in_(editable))
        ):
            index.setdefault(url_hash, []).append(workspace_id)
    return index


@router.get("/{workspace_id}", response_model_exclude_none=True)
async def workspace_detail(workspace_id: uuid.UUID, user: ReadyUser, session: SessionDep) -> WorkspaceDetailOut:
    await get_workspace(session, workspace_id, user.id, "viewer")
    rows = await session.execute(
        select(WorkspaceItem, Resource, Progress)
        .join(Resource, Resource.id == WorkspaceItem.resource_id)
        .outerjoin(Progress, (Progress.resource_id == Resource.id) & (Progress.user_id == user.id))
        .where(WorkspaceItem.workspace_id == workspace_id)
        .order_by(WorkspaceItem.position, WorkspaceItem.added_at)
    )
    return WorkspaceDetailOut(
        workspace=await workspace_out(session, workspace_id, user.id),
        items=[
            WorkspaceItemOut(
                resource=resource_out(resource),
                added_at=item.added_at,
                status=progress.status if progress else ProgressStatus.NOT_STARTED,
                percent=progress.percent if progress else 0,
            )
            for item, resource, progress in rows
        ],
    )


@router.patch("/{workspace_id}")
async def rename_workspace(workspace_id: uuid.UUID, body: WorkspaceIn, user: ReadyUser, session: SessionDep) -> WorkspaceOut:
    workspace, _ = await get_workspace(session, workspace_id, user.id, "owner")
    workspace.name = body.name
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise name_taken(workspace.team_id is not None, body.name) from e
    return await workspace_out(session, workspace_id, user.id)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(workspace_id: uuid.UUID, user: ReadyUser, session: SessionDep) -> Response:
    workspace, _ = await get_workspace(session, workspace_id, user.id, "owner")
    await session.delete(workspace)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{workspace_id}/items", status_code=status.HTTP_201_CREATED, response_model_exclude_none=True)
async def add_item(workspace_id: uuid.UUID, body: AddItemIn, user: ReadyUser, session: SessionDep) -> ResourceOut:
    await get_workspace(session, workspace_id, user.id, "editor")
    resource = await upsert_resource(session, body.resource, user.id)
    await session.execute(
        insert(WorkspaceItem)
        .values(workspace_id=workspace_id, resource_id=resource.id, added_by=user.id)
        .on_conflict_do_nothing()
    )
    await session.commit()
    return resource_out(resource)


@router.delete("/{workspace_id}/items/{url_hash}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_item(workspace_id: uuid.UUID, url_hash: str, user: ReadyUser, session: SessionDep) -> Response:
    await get_workspace(session, workspace_id, user.id, "editor")
    await session.execute(
        delete(WorkspaceItem).where(
            WorkspaceItem.workspace_id == workspace_id,
            WorkspaceItem.resource_id.in_(
                select(Resource.id).where(Resource.url_hash == url_hash)),
        )
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
