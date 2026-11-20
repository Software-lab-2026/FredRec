import uuid
from typing import Annotated, Literal
from pydantic import AfterValidator, Field
from app.models.base import ConceptRelation
from app.schemas.auth import ApiModel

NodeKind = Literal["topic", "concept"]


def _concept_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Enter a name.")
    if len(value) > 80:
        raise ValueError("Names must be at most 80 characters.")
    return value


Name = Annotated[str, AfterValidator(_concept_name)]
Description = Annotated[str, Field(max_length=500)]


class GraphNodeOut(ApiModel):
    id: uuid.UUID
    kind: NodeKind
    name: str
    description: str = ""


class GraphEdgeOut(ApiModel):
    id: uuid.UUID
    parent_kind: NodeKind
    parent_id: uuid.UUID
    child_id: uuid.UUID
    relation: ConceptRelation


class DomainGraphOut(ApiModel):
    domain_id: uuid.UUID
    domain_name: str
    nodes: list[GraphNodeOut]
    edges: list[GraphEdgeOut]


class ConceptCreateIn(ApiModel):
    domain_id: uuid.UUID
    name: Name
    description: Description = ""
    parent_kind: NodeKind
    parent_id: uuid.UUID
    relation: ConceptRelation = ConceptRelation.SUBTOPIC_OF


class ConceptUpdateIn(ApiModel):
    name: Name | None = None
    description: Description | None = None


class EdgeCreateIn(ApiModel):
    parent_kind: NodeKind
    parent_id: uuid.UUID
    child_id: uuid.UUID
    relation: ConceptRelation
