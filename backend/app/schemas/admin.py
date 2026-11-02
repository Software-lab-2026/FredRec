import uuid
from typing import Annotated
from pydantic import AfterValidator, Field
from app.core.validation import clean_email, clean_name, clean_password, clean_username
from app.schemas.auth import ApiModel


def _at_least_one(domain_ids: list[uuid.UUID]) -> list[uuid.UUID]:
    if not domain_ids:
        raise ValueError("Assign at least one domain.")
    return list(dict.fromkeys(domain_ids))


Name = Annotated[str, AfterValidator(clean_name)]
DomainIds = Annotated[list[uuid.UUID], AfterValidator(_at_least_one)]


class DomainOut(ApiModel):
    id: uuid.UUID
    name: str
    description: str
    topics: list[str]


class DomainCreateIn(ApiModel):
    name: Name
    description: Annotated[str, Field(max_length=200)] = ""


class DomainRenameIn(ApiModel):
    name: Name


class TopicCreateIn(ApiModel):
    name: Name
    description: Annotated[str, Field(max_length=1000)] = ""


class ExpertOut(ApiModel):
    id: uuid.UUID
    username: str
    email: str
    domain_ids: list[uuid.UUID]
    is_active: bool
    must_change_password: bool


class ExpertCreateIn(ApiModel):
    username: Annotated[str, AfterValidator(clean_username)]
    email: Annotated[str, AfterValidator(clean_email)]
    password: Annotated[str, AfterValidator(clean_password)]
    domain_ids: DomainIds


class ExpertUpdateIn(ApiModel):
    domain_ids: DomainIds | None = None
    is_active: bool | None = None
