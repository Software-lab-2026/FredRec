export type NodeKind = "topic" | "concept";

export type ConceptRelation = "subtopic_of" | "prerequisite_of" | "related_to";

export const RELATION_LABELS: Record<ConceptRelation, string> = {
  subtopic_of: "Subtopic of",
  prerequisite_of: "Prerequisite of",
  related_to: "Related to",
};

export interface GraphNode {
  id: string;
  kind: NodeKind;
  name: string;
  description: string;
}

export interface GraphEdge {
  id: string;
  parentKind: NodeKind;
  parentId: string;
  childId: string;
  relation: ConceptRelation;
}

export interface DomainGraph {
  domainId: string;
  domainName: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NewConcept {
  domainId: string;
  name: string;
  description?: string;
  parentKind: NodeKind;
  parentId: string;
}

export interface NewEdge {
  parentKind: NodeKind;
  parentId: string;
  childId: string;
  relation: ConceptRelation;
}
