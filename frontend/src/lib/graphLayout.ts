import dagre from "@dagrejs/dagre";
import type { DomainGraph } from "../types/concepts";

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 44;
export const ROOT_ID = "domain-root";

export function layoutGraph(graph: DomainGraph): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 16, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  g.setNode(ROOT_ID, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    if (node.kind === "topic") g.setEdge(ROOT_ID, node.id);
  }
  for (const edge of graph.edges) {
    if (edge.relation === "subtopic_of") g.setEdge(edge.parentId, edge.childId);
  }
  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of g.nodes()) {
    const { x, y } = g.node(id);
    positions.set(id, { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 });
  }
  return positions;
}
