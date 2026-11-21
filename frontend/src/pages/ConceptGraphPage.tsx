import "@xyflow/react/dist/style.css";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createConcept,
  createEdge,
  deleteConcept,
  deleteEdge,
  getDomainGraph,
  updateConcept,
} from "../api/concepts";
import { cardClass, dangerButton, errorText, inputClass, primaryButton, secondaryButton, selectClass } from "../components/styles";
import { useAuth } from "../context/useAuth";
import { graphKeys } from "../hooks/curationKeys";
import { layoutGraph, NODE_HEIGHT, NODE_WIDTH, ROOT_ID } from "../lib/graphLayout";
import { useIsDark } from "../theme";
import {
  type ConceptRelation,
  type DomainGraph,
  type GraphEdge,
  type GraphNode,
} from "../types/concepts";
import Loader from "../components/Loader";

type MapNodeData = { label: string; kind: "domain" | "topic" | "concept"; selected: boolean; editable: boolean };
type MapNode = Node<MapNodeData, "map">;

const KIND_STYLES: Record<MapNodeData["kind"], string> = {
  domain: "border-ink-800 bg-ink-800 text-white font-semibold dark:border-ink-200 dark:bg-ink-200 dark:text-ink-900",
  topic: "border-brand-300 bg-brand-50 text-brand-900 font-medium dark:border-brand-700 dark:bg-brand-950 dark:text-brand-100",
  concept: "border-ink-300 bg-white text-ink-800 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-100",
};

function MapNodeView({ data }: NodeProps<MapNode>) {
  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={`flex items-center rounded-lg border px-3 text-sm leading-tight shadow-sm ${KIND_STYLES[data.kind]} ${
        data.selected ? "ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-ink-950" : ""
      }`}
      title={data.label}
    >
      {data.kind !== "domain" && (
        <Handle type="target" position={Position.Left} isConnectable={false} className="!opacity-0" />
      )}
      <span className="line-clamp-2">{data.label}</span>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={data.editable && data.kind !== "domain"}
        className={data.editable && data.kind !== "domain" ? "!h-2.5 !w-2.5 !bg-brand-500" : "!opacity-0"}
      />
    </div>
  );
}

const nodeTypes = { map: MapNodeView };

function edgeLook(relation: ConceptRelation, dark: boolean): Partial<Edge> {
  if (relation === "prerequisite_of") {
    const stroke = dark ? "#fbbf24" : "#b45309";
    return {
      label: "prerequisite",
      style: { stroke, strokeWidth: 1.5, strokeDasharray: "6 4" },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
    };
  }
  if (relation === "related_to") {
    const stroke = dark ? "#38bdf8" : "#0369a1";
    return { label: "related", style: { stroke, strokeWidth: 1.5, strokeDasharray: "2 4" } };
  }
  const stroke = dark ? "#3a4f8a" : "#8a9ccb"; 
  return { style: { stroke, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: stroke } };
}

function toFlow(graph: DomainGraph, selectedId: string | null, editable: boolean, dark: boolean) {
  const positions = layoutGraph(graph);
  const make = (id: string, label: string, kind: MapNodeData["kind"]): MapNode => ({
    id,
    type: "map",
    position: positions.get(id) ?? { x: 0, y: 0 },
    data: { label, kind, selected: id === selectedId, editable },
    draggable: false,
  });
  const nodes = [make(ROOT_ID, graph.domainName, "domain"), ...graph.nodes.map((n) => make(n.id, n.name, n.kind))];
  const labelBg = dark ? "#020f33" : "#ffffff"; 
  const labelColor = dark ? "#b5c6e8" : "#1a3780"; 
  const edges: Edge[] = [
    ...graph.nodes
      .filter((n) => n.kind === "topic")
      .map((n) => ({ id: `root-${n.id}`, source: ROOT_ID, target: n.id, ...edgeLook("subtopic_of", dark) })),
    ...graph.edges.map((e) => ({
      id: e.id,
      source: e.parentId,
      target: e.childId,
      labelStyle: { fill: labelColor, fontSize: 11 },
      labelBgStyle: { fill: labelBg },
      ...edgeLook(e.relation, dark),
    })),
  ];
  return { nodes, edges };
}

export default function ConceptGraphPage() {
  const { domainId = "" } = useParams();
  const { user } = useAuth();
  const dark = useIsDark();
  const editable = !!user && (user.role === "admin" || (user.role === "expert" && user.domainIds.includes(domainId)));

  const graph = useQuery({ queryKey: graphKeys.domain(domainId), queryFn: () => getDomainGraph(domainId) });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A link drawn by dragging between two nodes, waiting for the expert to pick its kind.
  const [draft, setDraft] = useState<{ parentId: string; childId: string } | null>(null);
  const [notice, setNotice] = useState("");

  const flow = useMemo(
    () => (graph.data ? toFlow(graph.data, selectedId, editable, dark) : { nodes: [], edges: [] }),
    [graph.data, selectedId, editable, dark],
  );
  const byId = useMemo(() => new Map(graph.data?.nodes.map((n) => [n.id, n])), [graph.data]);
  const selected = selectedId ? byId.get(selectedId) : undefined;

  function onConnect(c: Connection) {
    setNotice("");
    const child = byId.get(c.target);
    if (!child || child.kind !== "concept") {
      setNotice("A link has to end at a concept; topics are managed by the admin.");
      return;
    }
    if (c.source === ROOT_ID) return;
    setSelectedId(child.id);
    setDraft({ parentId: c.source, childId: child.id });
  }

  if (graph.isPending) return <Loader />;
  if (graph.isError) return <p className={errorText}>{graph.error.message}</p>;

  return (
    <div>
      <p className="text-sm text-ink-500">
        <Link to="/topics" className="hover:underline">
          Topics
        </Link>{" "}
        › {graph.data.domainName}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{graph.data.domainName} concept map</h1>
      <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
        {editable
          ? "Select a topic or concept to add subtopics below it. Drag from a node’s dot to another concept to link them."
          : "How this domain’s topics break down into concepts. Select one to search for it."}
      </p>

      {notice && <p className={`mt-3 ${errorText}`}>{notice}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="h-[60vh] min-h-[420px] overflow-hidden rounded-xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950">
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={nodeTypes}
            forceColorMode={dark ? "dark" : "light"}
            style={{ background: "transparent" }}
            nodesConnectable={editable}
            nodesDraggable={false}
            onNodeClick={(_, node) => {
              setDraft(null);
              setNotice("");
              setSelectedId(node.id === ROOT_ID ? null : node.id);
            }}
            onPaneClick={() => setSelectedId(null)}
            onConnect={onConnect}
            fitView
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} bgColor="transparent" color={dark ? "#0a1f55" : "#d0dbf0"} />
            <Controls showInteractive={false} />
            <FitOnGrowth count={flow.nodes.length} />
          </ReactFlow>
        </div>

        <aside className="space-y-4">
          {selected ? (
            <NodePanel
              key={`${selected.id}-${draft?.parentId ?? ""}`}
              graph={graph.data}
              node={selected}
              editable={editable}
              draft={draft?.childId === selected.id ? draft : null}
              onDone={() => setDraft(null)}
              onDeleted={() => setSelectedId(null)}
            />
          ) : (
            <div className={cardClass}>
              <p className="text-sm text-ink-600 dark:text-ink-400">Nothing selected. Pick a node on the map or in the outline.</p>
              <Legend />
            </div>
          )}
        </aside>
      </div>

      <Outline graph={graph.data} selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  );
}

// makes sure all concept fit on screen
function FitOnGrowth({ count }: { count: number }) {
  const { fitView } = useReactFlow();
  // Only once React Flow has measured the nodes; fitting earlier leaves the view unscaled.
  const measured = useNodesInitialized();
  useEffect(() => {
    if (!measured) return;
    const id = requestAnimationFrame(() => void fitView({ duration: 200 }));
    return () => cancelAnimationFrame(id);
  }, [count, measured, fitView]);
  return null;
}

function Legend() {
  return (
    <ul className="mt-3 space-y-1.5 text-xs text-ink-600 dark:text-ink-400">
      <li className="flex items-center gap-2">
        <span className="h-3 w-5 rounded border border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950" /> Topic (set by the admin)
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3 w-5 rounded border border-ink-300 bg-white dark:border-ink-600 dark:bg-ink-900" /> Concept (added by experts)
      </li>
      <li className="flex items-center gap-2">
        <span className="w-5 border-t-2 border-ink-400" /> Subtopic
      </li>
      <li className="flex items-center gap-2">
        <span className="w-5 border-t-2 border-dashed border-amber-700 dark:border-amber-400" /> Prerequisite (arrow points to what it unlocks)
      </li>
      <li className="flex items-center gap-2">
        <span className="w-5 border-t-2 border-dotted border-sky-700 dark:border-sky-400" /> Related
      </li>
    </ul>
  );
}

// How a link reads from the selected node's side. 
function describeLink(edge: GraphEdge, nodeId: string, nameOf: (id: string) => string): string {
  const outgoing = edge.parentId === nodeId;
  const other = nameOf(outgoing ? edge.childId : edge.parentId);
  if (edge.relation === "subtopic_of") return outgoing ? `Has subtopic ${other}` : `Subtopic of ${other}`;
  if (edge.relation === "prerequisite_of") return outgoing ? `Prerequisite of ${other}` : `Needs ${other} first`;
  return `Related to ${other}`;
}

function NodePanel({
  graph,
  node,
  editable,
  draft,
  onDone,
  onDeleted,
}: {
  graph: DomainGraph;
  node: GraphNode;
  editable: boolean;
  draft: { parentId: string; childId: string } | null;
  onDone: () => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const key = graphKeys.domain(graph.domainId);
  const setGraph = (g: DomainGraph) => queryClient.setQueryData(key, g);
  const refetch = () => queryClient.invalidateQueries({ queryKey: key });
  const nameOf = (id: string) => graph.nodes.find((n) => n.id === id)?.name ?? "?";
  const links = graph.edges.filter((e) => e.parentId === node.id || e.childId === node.id);

  const [childName, setChildName] = useState("");
  const [childDescription, setChildDescription] = useState("");
  const add = useMutation({
    mutationFn: () =>
      createConcept({
        domainId: graph.domainId,
        name: childName,
        description: childDescription,
        parentKind: node.kind,
        parentId: node.id,
      }),
    onSuccess: (g) => {
      setGraph(g);
      setChildName("");
      setChildDescription("");
    },
  });

  const [name, setName] = useState(node.name);
  const [description, setDescription] = useState(node.description);
  const save = useMutation({ mutationFn: () => updateConcept(node.id, { name, description }), onSuccess: setGraph });
  const remove = useMutation({
    mutationFn: () => deleteConcept(node.id),
    onSuccess: async () => {
      await refetch();
      onDeleted();
    },
  });
  const unlink = useMutation({ mutationFn: deleteEdge, onSuccess: refetch });

  // "This concept is <relation> <other node>": the other node is the parent of the stored link.
  const [linkTo, setLinkTo] = useState(draft?.parentId ?? "");
  const [relation, setRelation] = useState<ConceptRelation>("subtopic_of");
  const link = useMutation({
    mutationFn: () =>
      createEdge({
        parentKind: graph.nodes.find((n) => n.id === linkTo)!.kind,
        parentId: linkTo,
        childId: node.id,
        relation,
      }),
    onSuccess: (g) => {
      setGraph(g);
      setLinkTo("");
      onDone();
    },
  });

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (childName.trim()) add.mutate();
  };

  return (
    <>
      <div className={cardClass}>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{node.kind}</p>
        <h2 className="mt-1 text-lg font-semibold">{node.name}</h2>
        {node.description && <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">{node.description}</p>}
        <Link
          to={`/search?q=${encodeURIComponent(node.name)}`}
          className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Search resources for this →
        </Link>
        {links.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-ink-200 pt-3 text-sm dark:border-ink-800">
            {links.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span className="text-ink-700 dark:text-ink-300">{describeLink(e, node.id, nameOf)}</span>
                {editable && (
                  <button
                    onClick={() => unlink.mutate(e.id)}
                    disabled={unlink.isPending}
                    aria-label={`Remove link: ${describeLink(e, node.id, nameOf)}`}
                    className="shrink-0 text-xs text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {unlink.isError && <p className={`mt-2 ${errorText}`}>{unlink.error.message}</p>}
      </div>

      {editable && (
        <form onSubmit={onAdd} className={`space-y-2 ${cardClass}`}>
          <h3 className="font-medium">Add a subtopic below “{node.name}”</h3>
          <input
            aria-label="Subtopic name"
            required
            maxLength={80}
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="e.g. Jacobian in FFNNs"
            className={inputClass}
          />
          <textarea
            aria-label="Description (optional)"
            maxLength={500}
            rows={2}
            value={childDescription}
            onChange={(e) => setChildDescription(e.target.value)}
            placeholder="Short description (optional)"
            className={inputClass}
          />
          <button type="submit" disabled={add.isPending} className={primaryButton}>
            Add subtopic
          </button>
          {add.isError && <p className={errorText}>{add.error.message}</p>}
        </form>
      )}

      {editable && node.kind === "concept" && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (linkTo) link.mutate();
            }}
            className={`space-y-2 ${cardClass} ${draft ? "ring-2 ring-brand-500" : ""}`}
          >
            <h3 className="font-medium">Link to another node</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>This concept is</span>
              <select
                aria-label="Kind of link"
                value={relation}
                onChange={(e) => setRelation(e.target.value as ConceptRelation)}
                className={selectClass}
              >
                <option value="subtopic_of">a subtopic of</option>
                <option value="prerequisite_of">unlocked by (needs first)</option>
                <option value="related_to">related to</option>
              </select>
              <select
                aria-label="Other node"
                required
                value={linkTo}
                onChange={(e) => setLinkTo(e.target.value)}
                className={`${selectClass} max-w-full`}
              >
                <option value="">Choose…</option>
                {graph.nodes
                  .filter((n) => n.id !== node.id)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.kind})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={!linkTo || link.isPending} className={primaryButton}>
                Add link
              </button>
              {draft && (
                <button type="button" onClick={onDone} className={secondaryButton}>
                  Cancel
                </button>
              )}
            </div>
            {link.isError && <p className={errorText}>{link.error.message}</p>}
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className={`space-y-2 ${cardClass}`}
          >
            <h3 className="font-medium">Edit this concept</h3>
            <input
              aria-label="Name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
            <textarea
              aria-label="Description"
              maxLength={500}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={save.isPending} className={secondaryButton}>
                Save
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => window.confirm(`Delete “${node.name}”? Its links are removed too.`) && remove.mutate()}
                className={dangerButton}
              >
                Delete
              </button>
            </div>
            {save.isError && <p className={errorText}>{save.error.message}</p>}
            {remove.isError && <p className={errorText}>{remove.error.message}</p>}
          </form>
        </>
      )}
    </>
  );
}

function Outline({
  graph,
  selectedId,
  onSelect,
}: {
  graph: DomainGraph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const children = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.relation === "subtopic_of") children.set(e.parentId, [...(children.get(e.parentId) ?? []), e.childId]);
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  const render = (id: string, seen: Set<string>): ReactNode => {
    const node = byId.get(id);
    if (!node || seen.has(id)) return null;
    const kids = (children.get(id) ?? []).map((c) => byId.get(c)!).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    const next = new Set(seen).add(id);
    return (
      <li key={id}>
        <button
          onClick={() => onSelect(id)}
          className={`rounded px-1.5 py-0.5 text-left text-sm hover:bg-ink-100 dark:hover:bg-ink-800 ${
            id === selectedId ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300" : ""
          } ${node.kind === "topic" ? "font-medium" : ""}`}
        >
          {node.name}
        </button>
        {kids.length > 0 && (
          <ul className="ml-4 border-l border-ink-200 pl-3 dark:border-ink-800">{kids.map((k) => render(k.id, next))}</ul>
        )}
      </li>
    );
  };

  return (
    <details className={`mt-6 ${cardClass}`}>
      <summary className="cursor-pointer font-medium">Outline</summary>
      <ul className="mt-3 space-y-1">{graph.nodes.filter((n) => n.kind === "topic").map((t) => render(t.id, new Set()))}</ul>
    </details>
  );
}
