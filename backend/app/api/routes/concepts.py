import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.api.deps import SessionDep, require_role
from app.models import Concept, ConceptEdge, Domain, Topic, User
from app.models.base import ConceptRelation, Role
from app.schemas.concepts import (
    ConceptCreateIn,
    ConceptUpdateIn,
    DomainGraphOut,
    EdgeCreateIn,
    GraphEdgeOut,
    GraphNodeOut,
)
from app.services.concepts import (
    check_parent,
    get_concept,
    refresh_embedding,
    require_editor,
    subtopic_parent_count,
    would_loop,
)

router = APIRouter(tags=["concept graph"])
EditorUser = Annotated[User, Depends(require_role(Role.EXPERT, Role.ADMIN))]


async def _graph(session, domain_id: uuid.UUID) -> DomainGraphOut:
    domain = await session.get(Domain, domain_id)
    if domain is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Domain not found.")
    topics = (await session.scalars(select(Topic).where(Topic.domain_id == domain_id).order_by(Topic.name))).all()
    concepts = (await session.scalars(select(Concept).where(Concept.domain_id == domain_id).order_by(Concept.name))).all()
    edges = (
        await session.scalars(
            select(ConceptEdge).where(ConceptEdge.child_id.in_(
                [c.id for c in concepts])).order_by(ConceptEdge.created_at)
        )
    ).all() if concepts else []
    return DomainGraphOut(
        domain_id=domain.id,
        domain_name=domain.name,
        nodes=[GraphNodeOut(id=t.id, kind="topic", name=t.name)
               for t in topics]
        + [GraphNodeOut(id=c.id, kind="concept", name=c.name,
                        description=c.description) for c in concepts],
        edges=[
            GraphEdgeOut(
                id=e.id,
                parent_kind="topic" if e.parent_topic_id else "concept",
                parent_id=e.parent_topic_id or e.parent_concept_id,
                child_id=e.child_id,
                relation=e.relation,
            )
            for e in edges
        ],
    )


@router.get("/domains/{domain_id}/graph")
async def domain_graph(domain_id: uuid.UUID, user: EditorUser, session: SessionDep) -> DomainGraphOut:
    await require_editor(session, user, domain_id)
    return await _graph(session, domain_id)


def _edge(kind: str, parent_id: uuid.UUID, child_id: uuid.UUID, relation: ConceptRelation, user: User) -> ConceptEdge:
    return ConceptEdge(
        parent_topic_id=parent_id if kind == "topic" else None,
        parent_concept_id=parent_id if kind == "concept" else None,
        child_id=child_id,
        relation=relation,
        created_by=user.id,
    )


@router.post("/expert/concepts", status_code=status.HTTP_201_CREATED)
async def create_concept(body: ConceptCreateIn, user: EditorUser, session: SessionDep) -> DomainGraphOut:
    await require_editor(session, user, body.domain_id)
    if body.relation == ConceptRelation.RELATED_TO:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            "A new concept needs a parent it belongs under.")
    await check_parent(session, body.domain_id, body.parent_kind, body.parent_id)
    concept = Concept(domain_id=body.domain_id, name=body.name,
                      description=body.description.strip(), created_by=user.id)
    session.add(concept)
    try:
        await session.flush()
    except IntegrityError as e:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"This domain already has a concept called “{
                            body.name}”.") from e
    session.add(_edge(body.parent_kind, body.parent_id,
                concept.id, ConceptRelation.SUBTOPIC_OF, user))
    await session.flush()
    await refresh_embedding(session, concept)
    await session.commit()
    return await _graph(session, body.domain_id)


@router.patch("/expert/concepts/{concept_id}")
async def update_concept(
    concept_id: uuid.UUID, body: ConceptUpdateIn, user: EditorUser, session: SessionDep
) -> DomainGraphOut:
    concept = await get_concept(session, concept_id)
    await require_editor(session, user, concept.domain_id)
    if body.name is not None:
        concept.name = body.name
    if body.description is not None:
        concept.description = body.description.strip()
    try:
        await session.flush()
    except IntegrityError as e:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"This domain already has a concept called “{
                            body.name}”.") from e
    await refresh_embedding(session, concept)
    await session.commit()
    return await _graph(session, concept.domain_id)


@router.delete("/expert/concepts/{concept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_concept(concept_id: uuid.UUID, user: EditorUser, session: SessionDep) -> Response:
    concept = await get_concept(session, concept_id)
    await require_editor(session, user, concept.domain_id)
    has_children = await session.scalar(
        select(ConceptEdge.id)
        .where(ConceptEdge.parent_concept_id == concept_id, ConceptEdge.relation == ConceptRelation.SUBTOPIC_OF)
        .limit(1)
    )
    if has_children:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Remove or move its subtopics first.")
    await session.delete(concept)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/expert/edges", status_code=status.HTTP_201_CREATED)
async def create_edge(body: EdgeCreateIn, user: EditorUser, session: SessionDep) -> DomainGraphOut:
    child = await get_concept(session, body.child_id)
    await require_editor(session, user, child.domain_id)
    await check_parent(session, child.domain_id, body.parent_kind, body.parent_id)
    if (
        body.parent_kind == "concept"
        and body.relation != ConceptRelation.RELATED_TO
        and await would_loop(session, body.parent_id, child.id)
    ):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "That link would create a loop.")
    if body.parent_kind == "concept" and body.parent_id == child.id:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "A concept can't link to itself.")
    session.add(_edge(body.parent_kind, body.parent_id,
                child.id, body.relation, user))
    try:
        await session.flush()
    except IntegrityError as e:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Those two are already linked that way.") from e
    if body.relation == ConceptRelation.SUBTOPIC_OF:
        await refresh_embedding(session, child)
    await session.commit()
    return await _graph(session, child.domain_id)


@router.delete("/expert/edges/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_edge(edge_id: uuid.UUID, user: EditorUser, session: SessionDep) -> Response:
    edge = await session.get(ConceptEdge, edge_id)
    if edge is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Link not found.")
    child = await get_concept(session, edge.child_id)
    await require_editor(session, user, child.domain_id)
    if edge.relation == ConceptRelation.SUBTOPIC_OF and await subtopic_parent_count(session, child.id) == 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This is the concept's only parent. Delete the concept instead, or add another parent first."
        )
    await session.delete(edge)
    await session.flush()
    if edge.relation == ConceptRelation.SUBTOPIC_OF:
        await refresh_embedding(session, child)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
