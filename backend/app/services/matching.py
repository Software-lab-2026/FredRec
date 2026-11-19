import uuid
from dataclasses import dataclass, field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.embeddings import embed_query
from app.models import Concept, ConceptEdge, Domain, Topic, TopicPhrase
from app.models.base import ConceptRelation, MatchKind, MatchMethod
from app.services.concepts import root_topic

SUGGESTION_MARGIN = 0.06


@dataclass
class Match:
    kind: MatchKind
    method: MatchMethod
    topic: Topic | None = None
    concept: Concept | None = None
    similarity: float | None = None
    domain_id: uuid.UUID | None = None
    suggestions: list[str] = field(default_factory=list)
    query_vector: list[float] | None = None


async def _nearest(session: AsyncSession, model, vector: list[float], limit: int = 4):
    distance = model.embedding.cosine_distance(vector)
    rows = await session.execute(
        select(model, distance).where(model.embedding.is_not(
            None)).order_by(distance).limit(limit)
    )
    return [(item, 1 - float(d)) for item, d in rows]


PHRASES_LOOKED_AT = 40


async def nearest_topics(session: AsyncSession, vector: list[float], limit: int = 4) -> list[tuple[Topic, float]]:
    best: dict[uuid.UUID, float] = {}
    distance = TopicPhrase.embedding.cosine_distance(vector)
    for topic_id, d in await session.execute(
        select(TopicPhrase.topic_id, distance).order_by(
            distance).limit(PHRASES_LOOKED_AT)
    ):
        best[topic_id] = max(best.get(topic_id, -1.0), 1 - float(d))
    for topic, similarity in await _nearest(session, Topic, vector, limit):
        best[topic.id] = max(best.get(topic.id, -1.0), similarity)
    ranked = sorted(best.items(), key=lambda pair: pair[1], reverse=True)[
        :limit]
    topics = {t.id: t for t in await session.scalars(select(Topic).where(Topic.id.in_([i for i, _ in ranked])))}
    return [(topics[i], similarity) for i, similarity in ranked]


async def _concept_match(session: AsyncSession, concept: Concept, method: MatchMethod, **kw) -> Match:
    topic = await root_topic(session, concept.id)
    return Match(MatchKind.CONCEPT, method, topic=topic, concept=concept, domain_id=concept.domain_id, **kw)


async def match_query(session: AsyncSession, query: str) -> Match:
    q = query.strip().lower()
    topics = (await session.scalars(select(Topic))).all()
    for topic in topics:
        if topic.name.lower() == q:
            return Match(MatchKind.TOPIC, MatchMethod.EXACT, topic=topic, domain_id=topic.domain_id)
    for topic in topics:
        if q in (a.lower() for a in topic.aliases):
            return Match(MatchKind.TOPIC, MatchMethod.ALIAS, topic=topic, domain_id=topic.domain_id)
    concept = await session.scalar(select(Concept).where(func.lower(Concept.name) == q).limit(1))
    if concept is not None:
        return await _concept_match(session, concept, MatchMethod.EXACT)

    vector = await embed_query(query.strip())
    candidates = []
    if vector is not None:
        candidates = await nearest_topics(session, vector) + await _nearest(session, Concept, vector)
        candidates.sort(key=lambda pair: pair[1], reverse=True)
    best = candidates[0] if candidates else None
    threshold = get_settings().topic_match_threshold
    if best and best[1] >= threshold:
        item, similarity = best
        others = [c.name for c, s in candidates[1:] if s >=
                  max(threshold, similarity - SUGGESTION_MARGIN)][:3]
        if isinstance(item, Concept):
            return await _concept_match(
                session, item, MatchMethod.VECTOR, similarity=similarity, suggestions=others, query_vector=vector
            )
        return Match(
            MatchKind.TOPIC, MatchMethod.VECTOR, topic=item, similarity=similarity, domain_id=item.domain_id,
            suggestions=others, query_vector=vector,
        )

    containing = sorted(
        (t for t in topics if q and q in t.name.lower()), key=lambda t: len(t.name))
    if containing:
        return Match(MatchKind.TOPIC, MatchMethod.PARTIAL, topic=containing[0], domain_id=containing[0].domain_id, query_vector=vector)
    near = [c for c, s in candidates if s >=
            get_settings().suggestion_threshold]
    return Match(
        MatchKind.NONE,
        MatchMethod.NONE,
        similarity=best[1] if best else None,
        domain_id=near[0].domain_id if near else None,
        suggestions=[c.name for c in near[:3]],
        query_vector=vector,
    )


async def match_path(session: AsyncSession, match: Match) -> list[str]:
    domain = await session.get(Domain, match.domain_id)
    if match.kind == MatchKind.TOPIC:
        return [domain.name, match.topic.name]
    chain = [match.concept.name]
    current = match.concept.id
    for _ in range(10):
        edge = await session.scalar(
            select(ConceptEdge)
            .where(ConceptEdge.child_id == current, ConceptEdge.relation == ConceptRelation.SUBTOPIC_OF)
            .order_by(ConceptEdge.parent_topic_id.is_(None), ConceptEdge.created_at)
            .limit(1)
        )
        if edge is None:
            break
        if edge.parent_topic_id:
            chain.append((await session.get(Topic, edge.parent_topic_id)).name)
            break
        current = edge.parent_concept_id
        chain.append((await session.get(Concept, current)).name)
    return [domain.name, *reversed(chain)]
