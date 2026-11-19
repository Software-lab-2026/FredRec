import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, literal, select, union
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.embeddings import embed_passages
from app.models import Concept, ConceptEdge, Domain, DomainExpert, Topic, User
from app.models.base import ConceptRelation, Role


async def require_editor(session: AsyncSession, user: User, domain_id: uuid.UUID) -> None:
    if user.role == Role.ADMIN:
        return
    assigned = await session.scalar(
        select(DomainExpert.user_id).where(DomainExpert.user_id ==
                                           user.id, DomainExpert.domain_id == domain_id)
    )
    if assigned is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Only this domain's experts and the admin can view or edit its concept map.")


async def get_concept(session: AsyncSession, concept_id: uuid.UUID) -> Concept:
    concept = await session.get(Concept, concept_id)
    if concept is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Concept not found.")
    return concept


async def check_parent(session: AsyncSession, domain_id: uuid.UUID, kind: str, parent_id: uuid.UUID) -> str:
    model = Topic if kind == "topic" else Concept
    parent = await session.get(model, parent_id)
    if parent is None or parent.domain_id != domain_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"That {
                            kind} isn't in this domain.")
    return parent.name


async def would_loop(session: AsyncSession, parent_id: uuid.UUID, child_id: uuid.UUID) -> bool:
    if parent_id == child_id:
        return True
    directed = ConceptEdge.relation != ConceptRelation.RELATED_TO
    below = select(ConceptEdge.child_id).where(
        ConceptEdge.parent_concept_id == child_id, directed).cte(recursive=True)
    below = below.union(
        select(ConceptEdge.child_id).join(
            below, ConceptEdge.parent_concept_id == below.c.child_id).where(directed)
    )
    return await session.scalar(select(literal(True)).where(select(below.c.child_id).where(below.c.child_id == parent_id).exists())) or False


async def parent_names(session: AsyncSession, concept_id: uuid.UUID) -> list[str]:
    topics = select(Topic.name).join(ConceptEdge, ConceptEdge.parent_topic_id == Topic.id).where(
        ConceptEdge.child_id == concept_id, ConceptEdge.relation == ConceptRelation.SUBTOPIC_OF
    )
    concepts = select(Concept.name).join(ConceptEdge, ConceptEdge.parent_concept_id == Concept.id).where(
        ConceptEdge.child_id == concept_id, ConceptEdge.relation == ConceptRelation.SUBTOPIC_OF
    )
    return sorted(await session.scalars(union(topics, concepts)))


async def refresh_embedding(session: AsyncSession, concept: Concept) -> None:
    domain = await session.get(Domain, concept.domain_id)
    parents = await parent_names(session, concept.id)
    text = f"{concept.name}. {concept.description}".strip()
    if parents:
        text += f" Part of {', '.join(parents)}."
    text += f" Domain: {domain.name}."
    vectors = await embed_passages([text])
    concept.embedding = vectors[0] if vectors else None


async def subtopic_parent_count(session: AsyncSession, concept_id: uuid.UUID) -> int:
    return await session.scalar(
        select(func.count()).where(
            ConceptEdge.child_id == concept_id, ConceptEdge.relation == ConceptRelation.SUBTOPIC_OF
        )
    )


async def root_topic(session: AsyncSession, concept_id: uuid.UUID) -> Topic | None:
    up = (
        select(ConceptEdge.parent_topic_id,
               ConceptEdge.parent_concept_id, literal(0).label("depth"))
        .where(ConceptEdge.child_id == concept_id, ConceptEdge.relation == ConceptRelation.SUBTOPIC_OF)
        .cte(recursive=True)
    )
    up = up.union(
        select(ConceptEdge.parent_topic_id,
               ConceptEdge.parent_concept_id, up.c.depth + 1)
        .join(up, ConceptEdge.child_id == up.c.parent_concept_id)
        .where(ConceptEdge.relation == ConceptRelation.SUBTOPIC_OF, up.c.depth < 20)
    )
    topic_id = await session.scalar(
        select(up.c.parent_topic_id).where(
            up.c.parent_topic_id.is_not(None)).order_by(up.c.depth).limit(1)
    )
    return await session.get(Topic, topic_id) if topic_id else None
