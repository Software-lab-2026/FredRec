import enum
import uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def enum_column(enum_class: type[enum.Enum], name: str) -> Enum:
    """Stores the enum's lowercase value as text with a CHECK, so adding a value is a simple migration."""
    return Enum(
        enum_class,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=32,
        values_callable=lambda members: [m.value for m in members],
    )


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(primary_key=True, default=uuid.uuid4)


def created_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


def updated_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Role(str, enum.Enum):
    ENDUSER = "enduser"
    EXPERT = "expert"
    ADMIN = "admin"


class ResourceFormat(str, enum.Enum):
    VIDEO = "video"
    COURSE = "course"
    PAPER = "paper"
    TEXTBOOK = "textbook"
    ARTICLE = "article"
    NOTES = "notes"
    REPO = "repo"


class Difficulty(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class ResourceOrigin(str, enum.Enum):
    FETCHED = "fetched"
    CURATED = "curated"


class ResourceStatus(str, enum.Enum):
    ACTIVE = "active"
    BROKEN = "broken"
    ARCHIVED = "archived"


class SubmissionStatus(str, enum.Enum):
    PENDING_EXPERT = "pending_expert"
    PENDING_ADMIN = "pending_admin"
    PUBLISHED = "published"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class SubmissionAction(str, enum.Enum):
    SUGGESTED = "suggested"
    REQUESTED = "requested"
    ADDED = "added"
    EXPERT_APPROVED = "expert_approved"
    EXPERT_REJECTED = "expert_rejected"
    ADMIN_APPROVED = "admin_approved"
    ADMIN_REJECTED = "admin_rejected"
    ARCHIVED = "archived"


class ProgressStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class WorkspaceKind(str, enum.Enum):
    PERSONAL = "personal"
    TEAM = "team"


class TeamRole(str, enum.Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


class InviteStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    REVOKED = "revoked"
