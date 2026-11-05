import re
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.embeddings import embed_passages
from app.models import Resource, Topic, TopicPhrase

_PHRASE_BREAK = re.compile(r",\s*|\.\s*|;\s*|\s+and\s+(?=[a-z]+ [a-z]+)")


def topic_text(name: str, description: str = "", aliases: list[str] | None = None) -> str:
    text = f"{name}: {description}" if description else f"{name}."
    return text + (f" Also called: {', '.join(aliases)}." if aliases else "")


def topic_phrases(name: str, description: str = "", aliases: list[str] | None = None) -> list[str]:
    parts = [p.strip() for p in _PHRASE_BREAK.split(description)]
    unique: dict[str, str] = {}
    for phrase in [name, *(aliases or []), *(p for p in parts if len(p) > 2)]:
        unique.setdefault(phrase.lower(), phrase)
    return list(unique.values())


def resource_text(resource: Resource) -> str:
    return f"{resource.title}. {resource.description}".strip()


async def embed_topics(session: AsyncSession, topics: list[Topic]) -> None:
    if not topics:
        return
    vectors = await embed_passages([topic_text(t.name, t.description, t.aliases) for t in topics])
    for topic, vector in zip(topics, vectors or [None] * len(topics), strict=True):
        topic.embedding = vector
    await session.execute(delete(TopicPhrase).where(TopicPhrase.topic_id.in_([t.id for t in topics])))
    phrases = [(t.id, p) for t in topics for p in topic_phrases(
        t.name, t.description, t.aliases)]
    phrase_vectors = await embed_passages([p for _, p in phrases])
    if phrase_vectors is None:
        return
    session.add_all(
        TopicPhrase(topic_id=topic_id, phrase=phrase, embedding=vector)
        for (topic_id, phrase), vector in zip(phrases, phrase_vectors, strict=True)
    )


async def embed_resource(session: AsyncSession, resource: Resource) -> None:
    vectors = await embed_passages([resource_text(resource)])
    resource.embedding = vectors[0] if vectors else None
