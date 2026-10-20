import type { IndexedEdge, IndexedNote, SqliteStore } from "@ideomy/index";

export type GraphTraversal = {
  root: IndexedNote;
  nodes: IndexedNote[];
  edges: IndexedEdge[];
  truncated: boolean;
};

const maxNodes = 50;
const maxEdges = 100;
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export class GraphError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GraphError";
  }
}

export function traverseProject(store: SqliteStore, projectId: string): GraphTraversal {
  const notes = store.notes();
  const root = notes.find((note) => note.entityId === projectId && note.type === "project");
  if (!root) throw new GraphError("GRAPH-001", "Project ID is missing from the index.");
  const byPath = new Map(notes.map((note) => [note.path, note]));
  const connected = store
    .edges()
    .filter((edge) => edge.sourcePath === root.path || edge.targetPath === root.path)
    .sort(
      (a, b) =>
        Number(a.kind === "wiki") - Number(b.kind === "wiki") ||
        compare(a.sourcePath, b.sourcePath) ||
        compare(a.targetPath, b.targetPath) ||
        compare(a.property ?? "", b.property ?? "") ||
        a.ordinal - b.ordinal,
    );
  const included = new Map([[root.path, root]]);
  const edges: IndexedEdge[] = [];
  const seen = new Set<string>();
  let truncated = false;
  for (const edge of connected) {
    const key = `${edge.kind}\0${edge.sourcePath}\0${edge.targetPath}\0${edge.property ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const otherPath = edge.sourcePath === root.path ? edge.targetPath : edge.sourcePath;
    const other = byPath.get(otherPath);
    if (!other) continue;
    if (edges.length >= maxEdges || (!included.has(otherPath) && included.size >= maxNodes)) {
      truncated = true;
      continue;
    }
    included.set(otherPath, other);
    edges.push(edge);
  }
  return { root, nodes: [...included.values()], edges, truncated };
}
