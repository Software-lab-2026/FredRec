import argparse
import asyncio
import getpass
import sys
from datetime import timedelta
from pathlib import Path
import yaml
from sqlalchemy import Engine, delete, func, select
from sqlalchemy.orm import Session
from app.core.config import BACKEND_DIR, MissingDatabaseUrl
from app.core.db import get_sync_engine
from app.core.security import hash_password
from app.core.validation import clean_email, clean_password, clean_username
from app.models import Concept, Resource, SearchEvent, Domain, Topic, User, SearchCache
from app.models.base import Role

SEED_FILE = BACKEND_DIR / "data" / "topics.yaml"


def create_admin(engine: Engine, username: str, email: str, password: str) -> None:
    username, email, password = clean_username(
        username), clean_email(email), clean_password(password)
    with Session(engine) as session:
        taken = session.scalar(
            select(User.id).where(
                (func.lower(User.username) == username.lower()) | (
                    func.lower(User.email) == email.lower())
            )
        )
        if taken:
            raise ValueError("That username or email is already in use.")
        session.add(User(username=username, email=email,
                    password_hash=hash_password(password), role=Role.ADMIN))
        session.commit()


def seed_domains(engine: Engine, seed_file: Path = SEED_FILE) -> tuple[int, int]:
    seed = yaml.safe_load(seed_file.read_text())
    new_domains = new_topics = 0
    with Session(engine) as session:
        domains = {d.name.lower(): d for d in session.scalars(select(Domain))}
        topics = {t.name.lower() for t in session.scalars(select(Topic))}
        for entry in seed:
            domain = domains.get(entry["name"].lower())
            if domain is None:
                domain = Domain(name=entry["name"])
                session.add(domain)
                session.flush()
                new_domains += 1
            for topic in entry["topics"]:
                if topic["name"].lower() not in topics:
                    session.add(
                        Topic(domain_id=domain.id, name=topic["name"], aliases=topic.get("aliases", [])))
                    topics.add(topic["name"].lower())
                    new_topics += 1
        session.commit()
    return new_domains, new_topics


def prune_cache(engine: Engine) -> int:
    with Session(engine) as session:
        deleted = session.execute(
            delete(SearchCache).where(SearchCache.expires_at <= func.now())).rowcount
        session.commit()
    return deleted


SEARCH_LOG_DAYS = 90


def prune_search_log(engine: Engine) -> int:
    with Session(engine) as session:
        deleted = session.execute(
            delete(SearchEvent).where(SearchEvent.created_at <
                                      func.now() - timedelta(days=SEARCH_LOG_DAYS))
        ).rowcount
        session.commit()
    return deleted


async def embed_all(refresh: bool = False) -> dict[str, int]:
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.core.db import get_async_engine
    from app.services.concepts import refresh_embedding
    from app.services.embedding_text import embed_resource, embed_topics

    def todo(model):
        query = select(model)
        return query if refresh else query.where(model.embedding.is_(None))

    counts = {}
    async with async_sessionmaker(get_async_engine(), expire_on_commit=False)() as session:
        topics = list(await session.scalars(todo(Topic)))
        await embed_topics(session, topics)
        counts["topics"] = len(topics)
        concepts = list(await session.scalars(todo(Concept)))
        for concept in concepts:
            await refresh_embedding(session, concept)
        counts["concepts"] = len(concepts)
        resources = list(await session.scalars(todo(Resource)))
        for resource in resources:
            await embed_resource(session, resource)
        counts["resources"] = len(resources)
        await session.commit()
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.cli", description="FredRec Tools")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser(
        "seed-domains", help="add the starting domains and topics")
    commands.add_parser(
        "prune-cache", help="delete expired search-cache entries")
    commands.add_parser(
        "prune-search-log", help=f"delete search-log entries older than {SEARCH_LOG_DAYS} days")
    embed = commands.add_parser(
        "embed-all", help="compute missing embeddings for meaning-based search")
    embed.add_argument("--refresh", action="store_true",
                       help="recompute every embedding, not just missing ones")
    admin = commands.add_parser(
        "create-admin", help="create an admin account (asks for the password)")
    admin.add_argument("--username", required=True)
    admin.add_argument("--email", required=True)
    args = parser.parse_args()

    try:
        engine = get_sync_engine()
    except MissingDatabaseUrl as e:
        print(e, file=sys.stderr)
        return 1
    if args.command == "prune-search-log":
        print(f"Deleted {prune_search_log(
            engine)} search-log entries older than {SEARCH_LOG_DAYS} days.")
        return 0
    if args.command == "embed-all":
        counts = asyncio.run(embed_all(args.refresh))
        print("Embedded " +
              ", ".join(f"{n} {kind}" for kind, n in counts.items()) + ".")
        return 0
    if args.command == "prune-cache":
        print(f"Deleted {prune_cache(engine)} expired cache entries.")
        return 0
    if args.command == "seed-domains":
        new_domains, new_topics = seed_domains(engine)
        print(f"Added {new_domains} domains and {new_topics} topics.")
        return 0

    password = getpass.getpass("Password: ")
    if password != getpass.getpass("Confirm password: "):
        print("The passwords don't match.", file=sys.stderr)
        return 1
    try:
        create_admin(engine, args.username, args.email, password)
    except ValueError as e:
        print(e, file=sys.stderr)
        return 1
    print(f"Admin @{args.username} created.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
