from collections import Counter
from datetime import UTC, date, datetime, timedelta
from sqlalchemy import Select, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Concept, ConceptEdge, DomainExpert, Resource, ResourceSubmission, SearchEvent, SubmissionEvent, Topic, User
from app.models.base import (
    ConceptRelation,
    MatchKind,
    ResourceOrigin,
    ResourceStatus,
    Role,
    SubmissionAction,
    SubmissionStatus,
)
from app.schemas.stats import (
    AdminStats,
    AdminTotals,
    DayCount,
    ExpertStats,
    ExpertTotals,
    NameCount,
    Pipeline,
    TopicCoverage,
)

TOP = 10


def _since(days: int) -> datetime:
    return datetime.now(UTC) - timedelta(days=days)


async def _count(session: AsyncSession, query: Select) -> int:
    return await session.scalar(select(func.count()).select_from(query.subquery()))


def _published_curated():
    return (Resource.origin == ResourceOrigin.CURATED) & (Resource.status == ResourceStatus.ACTIVE)


async def _searches_per_day(session: AsyncSession, days: int, *conditions) -> list[DayCount]:
    day = func.date(SearchEvent.created_at)
    rows = await session.execute(
        select(day, SearchEvent.matched_kind, func.count())
        .where(SearchEvent.created_at >= _since(days), *conditions)
        .group_by(day, SearchEvent.matched_kind)
    )
    counts: dict[date, list[int]] = {}
    for d, kind, n in rows:
        counts.setdefault(d, [0, 0])[1 if kind == MatchKind.NONE else 0] += n
    today = datetime.now(UTC).date()
    series = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]
    return [DayCount(day=d, matched=counts.get(d, [0, 0])[0], unmatched=counts.get(d, [0, 0])[1]) for d in series]


async def _top_topics(session: AsyncSession, days: int, *conditions) -> list[NameCount]:
    rows = await session.execute(
        select(Topic.name, func.count())
        .join(SearchEvent, SearchEvent.topic_id == Topic.id)
        .where(SearchEvent.created_at >= _since(days), *conditions)
        .group_by(Topic.name)
        .order_by(func.count().desc(), Topic.name)
        .limit(TOP)
    )
    return [NameCount(name=n, count=c) for n, c in rows]


async def admin_stats(session: AsyncSession, days: int) -> AdminStats:
    since = _since(days)
    roles = Counter(dict((await session.execute(select(User.role, func.count()).where(User.is_active).group_by(User.role))).all()))
    statuses = Counter(
        dict(
            (await session.execute(
                select(ResourceSubmission.status, func.count())
                .where(ResourceSubmission.created_at >= since)
                .group_by(ResourceSubmission.status)
            )).all()
        )
    )
    hours = func.extract(
        "epoch", ResourceSubmission.admin_reviewed_at - ResourceSubmission.created_at) / 3600
    median = await session.scalar(
        select(func.percentile_cont(0.5).within_group(hours)).where(
            ResourceSubmission.status == SubmissionStatus.PUBLISHED, ResourceSubmission.admin_reviewed_at >= since
        )
    )
    by_kind = Counter(
        dict(
            (await session.execute(
                select(SearchEvent.matched_kind, func.count())
                .where(SearchEvent.created_at >= since)
                .group_by(SearchEvent.matched_kind)
            )).all()
        )
    )

    return AdminStats(
        days=days,
        totals=AdminTotals(
            learners=roles[Role.ENDUSER],
            experts=roles[Role.EXPERT],
            published_resources=await _count(session, select(Resource.id).where(_published_curated())),
            waiting_for_admin=await _count(
                session,
                select(ResourceSubmission.id).where(
                    ResourceSubmission.status == SubmissionStatus.PENDING_ADMIN),
            ),
            searches=sum(by_kind.values()),
            unmatched_searches=by_kind[MatchKind.NONE],
        ),
        searches_per_day=await _searches_per_day(session, days),
        top_topics=await _top_topics(session, days),
        pipeline=Pipeline(
            waiting_for_expert=statuses[SubmissionStatus.PENDING_EXPERT],
            waiting_for_admin=statuses[SubmissionStatus.PENDING_ADMIN],
            published=statuses[SubmissionStatus.PUBLISHED] +
            statuses[SubmissionStatus.ARCHIVED],
            rejected=statuses[SubmissionStatus.REJECTED],
            median_hours_to_publish=round(
                float(median), 1) if median is not None else None,
        ),
    )


async def expert_stats(session: AsyncSession, expert: User, days: int) -> ExpertStats:
    since = _since(days)
    mine = list(await session.scalars(select(DomainExpert.domain_id).where(DomainExpert.user_id == expert.id)))
    in_mine = SearchEvent.domain_id.in_(mine)

    below = (
        select(ConceptEdge.parent_topic_id.label("topic_id"),
               ConceptEdge.child_id, literal(0).label("depth"))
        .join(Topic, Topic.id == ConceptEdge.parent_topic_id)
        .where(Topic.domain_id.in_(mine), ConceptEdge.relation == ConceptRelation.SUBTOPIC_OF)
        .cte(recursive=True)
    )
    below = below.union(
        select(below.c.topic_id, ConceptEdge.child_id, below.c.depth + 1)
        .join(ConceptEdge, ConceptEdge.parent_concept_id == below.c.child_id)
        .where(ConceptEdge.relation == ConceptRelation.SUBTOPIC_OF, below.c.depth < 20)
    )
    concepts_per_topic = dict(
        (await session.execute(select(below.c.topic_id, func.count(func.distinct(below.c.child_id))).group_by(below.c.topic_id))).all()
    )
    published_per_topic = dict(
        (await session.execute(select(Resource.topic_id, func.count()).where(_published_curated()).group_by(Resource.topic_id))).all()
    )
    topics = [
        TopicCoverage(topic=t.name, concepts=concepts_per_topic.get(
            t.id, 0), published=published_per_topic.get(t.id, 0))
        for t in await session.scalars(select(Topic).where(Topic.domain_id.in_(mine)).order_by(Topic.name))
    ]

    top_searches = await session.execute(
        select(SearchEvent.query, func.count())
        .where(SearchEvent.created_at >= since, in_mine, SearchEvent.matched_kind != MatchKind.NONE)
        .group_by(SearchEvent.query)
        .order_by(func.count().desc(), SearchEvent.query)
        .limit(TOP)
    )
    difficulty = await session.execute(
        select(Resource.difficulty, func.count())
        .join(Topic, Topic.id == Resource.topic_id)
        .where(_published_curated(), Topic.domain_id.in_(mine))
        .group_by(Resource.difficulty)
    )
    return ExpertStats(
        days=days,
        totals=ExpertTotals(
            waiting=await _count(
                session,
                select(ResourceSubmission.id).where(
                    ResourceSubmission.status == SubmissionStatus.PENDING_EXPERT, ResourceSubmission.domain_id.in_(
                        mine)
                ),
            ),
            my_reviews=await _count(
                session,
                select(SubmissionEvent.id).where(
                    SubmissionEvent.actor_id == expert.id,
                    SubmissionEvent.action.in_(
                        (SubmissionAction.EXPERT_APPROVED, SubmissionAction.EXPERT_REJECTED)),
                    SubmissionEvent.created_at >= since,
                ),
            ),
            concepts=await _count(session, select(Concept.id).where(Concept.domain_id.in_(mine))),
            searches=await _count(
                session, select(SearchEvent.id).where(
                    SearchEvent.created_at >= since, in_mine)
            ),
        ),
        top_searches=[NameCount(name=q, count=c) for q, c in top_searches],
        topics=topics,
        difficulty=[NameCount(name=d.value, count=c)
                    for d, c in difficulty if d is not None],
    )
