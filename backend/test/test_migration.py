from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Connection, inspect
from app.models import Base


def test_migrations_match_the_models(connection: Connection):
    context = MigrationContext.configure(
        connection, opts={"compare_type": True})
    assert compare_metadata(context, Base.metadata) == []


def test_migrations_create_every_table(connection: Connection):
    assert set(Base.metadata.tables) <= set(
        inspect(connection).get_table_names())


def test_downgrade_removes_everything_and_upgrade_restores_it(connection: Connection, alembic_config):
    command.downgrade(alembic_config, "base")
    assert set(inspect(connection).get_table_names()) <= {"alembic_version"}
    command.upgrade(alembic_config, "head")
    assert set(Base.metadata.tables) <= set(
        inspect(connection).get_table_names())
