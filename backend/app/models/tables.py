import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import (
    Base,
    Difficulty,
    InviteStatus,
    ProgressStatus,
    ResourceFormat,
    ResourceOrigin,
    ResourceStatus,
    Role,
    SubmissionAction,
    SubmissionStatus,
    TeamRole,
    WorkspaceKind,
    created_at,
    enum_column,
    updated_at,
    uuid_pk,
)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("uq_users_username_lower", text("lower(username)"), unique=True),
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
        CheckConstraint(
            "username ~ '^[A-Za-z0-9_]{3,20}$'", name="username_format"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    username: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(320))
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[Role] = mapped_column(enum_column(
        Role, "role"), default=Role.ENDUSER, server_default="enduser")
    must_change_password: Mapped[bool] = mapped_column(
        default=False, server_default=text("false"))
    is_active: Mapped[bool] = mapped_column(
        default=True, server_default=text("true"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = created_at()


class Domain(Base):
    __tablename__ = "domains"
    __table_args__ = (Index("uq_domains_name_lower",
                      text("lower(name)"), unique=True),)

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(
        Text, default="", server_default="")
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = created_at()


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = (
        Index("uq_topics_name_lower", text("lower(name)"), unique=True),
        UniqueConstraint("id", "domain_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    domain_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("domains.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    aliases: Mapped[list[str]] = mapped_column(
        ARRAY(Text), default=list, server_default="{}")
    created_at: Mapped[datetime] = created_at()


class DomainExpert(Base):
    __tablename__ = "domain_experts"

    domain_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(
        "domains.id", ondelete="RESTRICT"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(
        "users.id", ondelete="CASCADE"), primary_key=True, index=True)
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"))
    assigned_at: Mapped[datetime] = created_at()


class Resource(Base):

    __tablename__ = "resources"
    __table_args__ = (
        CheckConstraint(
            "origin <> 'curated' OR (topic_id IS NOT NULL AND difficulty IS NOT NULL AND published_at IS NOT NULL)",
            name="curated_is_complete",
        ),
        CheckConstraint(
            "avg_rating IS NULL OR avg_rating BETWEEN 1 AND 5", name="avg_rating_range"),
        CheckConstraint("review_count >= 0", name="review_count_not_negative"),
        Index("ix_resources_curated_topic", "topic_id", postgresql_where=text(
            "origin = 'curated' AND status = 'active'")),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    url: Mapped[str] = mapped_column(Text)
    url_hash: Mapped[str] = mapped_column(String(64), unique=True)
    title: Mapped[str] = mapped_column(Text)
    format: Mapped[ResourceFormat] = mapped_column(
        enum_column(ResourceFormat, "format"))
    source: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(
        Text, default="", server_default="")
    authors: Mapped[list[str]] = mapped_column(
        ARRAY(Text), default=list, server_default="{}")
    thumbnail: Mapped[str | None] = mapped_column(Text)
    duration_minutes: Mapped[int | None]
    pages: Mapped[int | None]
    published_year: Mapped[int | None]
    difficulty: Mapped[Difficulty | None] = mapped_column(
        enum_column(Difficulty, "difficulty"))
    extra: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, default=dict, server_default="{}")
    avg_rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    review_count: Mapped[int] = mapped_column(default=0, server_default="0")
    origin: Mapped[ResourceOrigin] = mapped_column(
        enum_column(ResourceOrigin, "origin"), default=ResourceOrigin.FETCHED, server_default="fetched"
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("topics.id", ondelete="RESTRICT"))
    status: Mapped[ResourceStatus] = mapped_column(
        enum_column(ResourceStatus, "status"), default=ResourceStatus.ACTIVE, server_default="active"
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True))
    first_added_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class ResourceSubmission(Base):

    __tablename__ = "resource_submissions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["topic_id", "domain_id"],
            ["topics.id", "topics.domain_id"],
            name="fk_resource_submissions_topic_in_domain",
            ondelete="RESTRICT",
        ),
        Index(
            "uq_resource_submissions_active_url",
            "url_hash",
            unique=True,
            postgresql_where=text(
                "status IN ('pending_expert', 'pending_admin', 'published')"),
        ),
        CheckConstraint(
            "status NOT IN ('pending_admin', 'published', 'archived') OR difficulty IS NOT NULL",
            name="difficulty_set_after_expert",
        ),
        CheckConstraint(
            "status NOT IN ('published', 'archived') OR resource_id IS NOT NULL",
            name="published_has_resource",
        ),
        Index("ix_resource_submissions_queue", "status", "domain_id"),
        Index("ix_resource_submissions_submitter",
              "submitted_by", "created_at"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    url: Mapped[str] = mapped_column(Text)
    url_hash: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(
        Text, default="", server_default="")
    format: Mapped[ResourceFormat] = mapped_column(
        enum_column(ResourceFormat, "format"))
    domain_id: Mapped[uuid.UUID] = mapped_column()
    topic_id: Mapped[uuid.UUID] = mapped_column()
    suggested_difficulty: Mapped[Difficulty | None] = mapped_column(
        enum_column(Difficulty, "suggested_difficulty"))
    difficulty: Mapped[Difficulty | None] = mapped_column(
        enum_column(Difficulty, "difficulty"))
    submitted_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"))
    status: Mapped[SubmissionStatus] = mapped_column(
        enum_column(SubmissionStatus, "status"))
    expert_reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"))
    expert_note: Mapped[str | None] = mapped_column(Text)
    expert_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True))
    admin_reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"))
    admin_note: Mapped[str | None] = mapped_column(Text)
    admin_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True))
    resource_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("resources.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = created_at()


class SubmissionEvent(Base):
    __tablename__ = "submission_events"

    id: Mapped[uuid.UUID] = uuid_pk()
    submission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resource_submissions.id", ondelete="CASCADE"), index=True
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"))
    action: Mapped[SubmissionAction] = mapped_column(
        enum_column(SubmissionAction, "action"))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at()


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (CheckConstraint(
        "rating BETWEEN 1 AND 5", name="rating_range"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(
        "users.id", ondelete="CASCADE"), primary_key=True)
    resource_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resources.id", ondelete="RESTRICT"), primary_key=True, index=True
    )
    rating: Mapped[int]
    text_: Mapped[str] = mapped_column(
        "text", Text, default="", server_default="")
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class Progress(Base):
    __tablename__ = "progress"
    __table_args__ = (
        CheckConstraint("percent BETWEEN 0 AND 100", name="percent_range"),
        CheckConstraint("status <> 'completed' OR percent = 100",
                        name="completed_is_100"),
        CheckConstraint("status <> 'not_started' OR percent = 0",
                        name="not_started_is_0"),
        CheckConstraint("time_spent_minutes >= 0", name="time_not_negative"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(
        "users.id", ondelete="CASCADE"), primary_key=True)
    resource_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(
        "resources.id", ondelete="RESTRICT"), primary_key=True)
    status: Mapped[ProgressStatus] = mapped_column(
        enum_column(ProgressStatus, "status"), default=ProgressStatus.NOT_STARTED, server_default="not_started"
    )
    percent: Mapped[int] = mapped_column(default=0, server_default="0")
    time_spent_minutes: Mapped[int] = mapped_column(
        default=0, server_default="0")
    updated_at: Mapped[datetime] = updated_at()


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(60))
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = created_at()


class TeamMember(Base):
    __tablename__ = "team_members"

    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(
        "teams.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(
        "users.id", ondelete="CASCADE"), primary_key=True, index=True)
    role: Mapped[TeamRole] = mapped_column(enum_column(
        TeamRole, "role"), default=TeamRole.VIEWER, server_default="viewer")
    joined_at: Mapped[datetime] = created_at()


class TeamInvite(Base):
    __tablename__ = "team_invites"
    __table_args__ = (
        CheckConstraint(
            "num_nonnulls(invited_user_id, email) = 1", name="one_invitee"),
        Index(
            "uq_team_invites_pending_user",
            "team_id",
            "invited_user_id",
            unique=True,
            postgresql_where=text(
                "status = 'pending' AND invited_user_id IS NOT NULL"),
        ),
        Index(
            "uq_team_invites_pending_email",
            "team_id",
            text("lower(email)"),
            unique=True,
            postgresql_where=text("status = 'pending' AND email IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"))
    invited_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"))
    email: Mapped[str | None] = mapped_column(String(320))
    role: Mapped[TeamRole] = mapped_column(enum_column(
        TeamRole, "role"), default=TeamRole.VIEWER, server_default="viewer")
    status: Mapped[InviteStatus] = mapped_column(
        enum_column(InviteStatus, "status"), default=InviteStatus.PENDING, server_default="pending"
    )
    invited_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = created_at()
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True))


class Workspace(Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        CheckConstraint(
            "(kind = 'personal' AND owner_user_id IS NOT NULL AND team_id IS NULL) "
            "OR (kind = 'team' AND team_id IS NOT NULL AND owner_user_id IS NULL)",
            name="one_owner",
        ),
        Index(
            "uq_workspaces_user_name",
            "owner_user_id",
            text("lower(name)"),
            unique=True,
            postgresql_where=text("owner_user_id IS NOT NULL"),
        ),
        Index(
            "uq_workspaces_team_name",
            "team_id",
            text("lower(name)"),
            unique=True,
            postgresql_where=text("team_id IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(60))
    kind: Mapped[WorkspaceKind] = mapped_column(
        enum_column(WorkspaceKind, "kind"), default=WorkspaceKind.PERSONAL, server_default="personal"
    )
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"))
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = created_at()


class WorkspaceItem(Base):
    __tablename__ = "workspace_items"

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(
        "workspaces.id", ondelete="CASCADE"), primary_key=True)
    resource_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resources.id", ondelete="RESTRICT"), primary_key=True, index=True
    )
    position: Mapped[int] = mapped_column(default=0, server_default="0")
    added_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"))
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"))
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now())
