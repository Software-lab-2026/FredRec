import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.cli import create_admin, seed_domains
from app.core.config import Settings
from app.core.security import hash_password, verify_password
from app.models import Domain, Topic, User
from app.models.base import Role


def test_create_admin_stores_a_hash_not_the_password(connection):
    create_admin(connection, "root_admin", "root@example.com", "correct-horse")
    with Session(connection) as session:
        admin = session.scalar(select(User).where(
            User.username == "root_admin"))
    assert admin.role is Role.ADMIN
    assert admin.password_hash != "correct-horse"
    assert verify_password(admin.password_hash, "correct-horse")
    assert not verify_password(admin.password_hash, "wrong")


@pytest.mark.parametrize(
    ("username", "email", "password"),
    [
        ("taken_name", "other@example.com", "long-enough"),
        ("other", "TAKEN@example.com", "long-enough"),
        ("other", "not-an-email", "long-enough"),
        ("other", "other@example.com", "short"),
        ("not valid", "other@example.com", "long-enough"),
    ],
)
def test_create_admin_rejects_bad_input(connection, username, email, password):
    create_admin(connection, "taken_name", "taken@example.com", "long-enough")
    with pytest.raises(ValueError):
        create_admin(connection, username, email, password)


def test_seed_loads_every_domain_and_topic_and_can_be_rerun(connection):
    assert seed_domains(connection) == (12, 75)
    assert seed_domains(connection) == (0, 0)
    with Session(connection) as session:
        assert session.scalar(select(func.count()).select_from(Domain)) == 12
        ml = session.scalar(select(Topic).where(
            Topic.name == "Machine Learning"))
        assert ml.aliases == ["ml"]


def test_seed_keeps_admin_edits_to_topics(connection):
    seed_domains(connection)
    with Session(connection) as session:
        topic = session.scalar(select(Topic).where(Topic.name == "Linux"))
        topic.aliases = ["gnu"]
        session.commit()
    seed_domains(connection)
    with Session(connection) as session:
        assert session.scalar(select(Topic).where(
            Topic.name == "Linux")).aliases == ["gnu"]


def test_password_hashes_are_salted():
    assert hash_password("same") != hash_password("same")


def test_neon_url_gets_the_driver_and_keeps_its_options():
    settings = Settings(
        _env_file=None, database_url="postgresql://u:p@ep-x.neon.tech/db?sslmode=require&channel_binding=require"
    )
    assert settings.sqlalchemy_url == "postgresql+psycopg://u:p@ep-x.neon.tech/db?sslmode=require&channel_binding=require"


@pytest.mark.parametrize("url", ["", "postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"])
def test_missing_url_gives_a_clear_error(url):
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        Settings(_env_file=None, database_url=url).sqlalchemy_url
