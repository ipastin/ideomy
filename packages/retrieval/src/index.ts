import { traverseProject } from "@ideomy/graph";
import type { IndexedNote, SqliteStore } from "@ideomy/index";

export type PackItem = {
  text: string;
  trust: "untrusted_data";
  source: { entityId: string | null; path: string; hash: string };
};

export const projectSections = [
  "projectSummary",
  "currentState",
  "goal",
  "recentDecisions",
  "relevantKnowledge",
  "recentActivity",
  "people",
  "constraints",
  "openQuestions",
] as const;
const candidateSections = ["recentDecisions", "relevantKnowledge", "recentActivity", "people"] as const;

export type ProjectContextPack = {
  kind: "project";
  projectId: string;
  vaultFingerprint: string;
  indexRevision: string;
  sections: Record<(typeof projectSections)[number], PackItem[]>;
  omittedCount: number;
  truncated: boolean;
};

export type AccessContext = {
  purpose: "agent_context";
  vaultFingerprint: string;
  expectedRevision: string;
};

export type ScopedRequest = {
  query: string;
  scope: { kind: "unscoped" } | { kind: "area"; areaId: string };
  confirmedInboxRoot?: string;
  vaultFingerprint: string;
  expectedRevision: string;
} & ({ purpose: "agent_context" } | { purpose: "local_discovery" });

type ScopedMetadata = {
  entityId: string | null;
  path: string;
  hash: string;
  title: string;
  type: string | null;
  status: string | null;
  agentAccess: string;
  sourceKind: "managed" | "unmanaged" | "raw_web_capture" | "raw_inbox" | "processed_source";
  scopeReason: "unscoped" | "primary_area" | "related_areas";
  trust: "untrusted_data";
};

export type ScopedResult =
  | {
      purpose: "agent_context";
      vaultFingerprint: string;
      indexRevision: string;
      hits: (ScopedMetadata & { text: string })[];
    }
  | { purpose: "local_discovery"; vaultFingerprint: string; indexRevision: string; hits: ScopedMetadata[] };

export class RetrievalError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RetrievalError";
  }
}

const allowed = (note: IndexedNote): boolean =>
  note.agentAccess === "allowed" && ["public", "internal", "private"].includes(note.sensitivity);

const candidateSection = (note: IndexedNote): (typeof candidateSections)[number] | null =>
  note.type === "decision" && note.status === "accepted"
    ? "recentDecisions"
    : note.type === "knowledge" || note.type === "source"
      ? "relevantKnowledge"
      : note.type === "person"
        ? "people"
        : ["meeting", "event", "record", "journal"].includes(note.type ?? "")
          ? "recentActivity"
          : null;

const authority = (note: IndexedNote): number => {
  if (note.type === "decision" && note.status === "accepted") return 8;
  if (note.type === "knowledge" && note.status === "evergreen") return 7;
  if (note.type === "record" && note.status === "verified") return 6;
  if (note.type === "project") return 5;
  if (note.type === "source") return 4;
  if (note.type === "meeting") return 3;
  if (note.type === "journal") return 1;
  return note.entityId ? 2 : 0;
};

export function retrieveScoped(
  store: SqliteStore,
  request: ScopedRequest & { purpose: "agent_context" },
): Extract<ScopedResult, { purpose: "agent_context" }>;
export function retrieveScoped(
  store: SqliteStore,
  request: ScopedRequest & { purpose: "local_discovery" },
): Extract<ScopedResult, { purpose: "local_discovery" }>;
export function retrieveScoped(store: SqliteStore, request: ScopedRequest): ScopedResult {
  const revision = store.revision();
  if (!request.vaultFingerprint || request.vaultFingerprint !== store.vaultFingerprint())
    throw new RetrievalError("RETRIEVAL-001", "Wrong Vault fingerprint.");
  if (!revision || revision !== request.expectedRevision)
    throw new RetrievalError("RETRIEVAL-002", "Index revision is missing or stale.");
  const root = request.confirmedInboxRoot;
  if (
    root !== undefined &&
    (!root || root.startsWith("/") || root.split("/").some((part) => !part || part === "." || part === ".."))
  )
    throw new RetrievalError("RETRIEVAL-004", "Confirmed Inbox root must be a relative Vault path.");
  const notes = store.notes();
  const areaId = request.scope.kind === "area" ? request.scope.areaId : null;
  if (
    request.scope.kind === "area" &&
    (!areaId || !notes.some((note) => note.entityId === areaId && note.type === "area"))
  )
    throw new RetrievalError("RETRIEVAL-004", "Area ID is missing from the index.");
  const areaReason = new Map<string, "primary_area" | "related_areas">();
  if (areaId) {
    const area = notes.find((note) => note.entityId === areaId);
    for (const edge of store.edges()) {
      if (edge.kind !== "typed" || edge.targetPath !== area?.path) continue;
      if (edge.property === "primary_area") areaReason.set(edge.sourcePath, "primary_area");
      else if (edge.property === "related_areas" && !areaReason.has(edge.sourcePath))
        areaReason.set(edge.sourcePath, "related_areas");
    }
  }
  const byPath = new Map(notes.map((note) => [note.path, note]));
  const rank = (operator: "and" | "or") =>
    store.searchTerms(request.query, operator).flatMap((hit) => {
      const note = byPath.get(hit.path);
      if (!note || (note.kind === "managed" && note.agentAccess === "denied")) return [];
      const scopeReason: ScopedMetadata["scopeReason"] | undefined = areaId ? areaReason.get(note.path) : "unscoped";
      if (!scopeReason) return [];
      const inInbox = root !== undefined && (note.path === root || note.path.startsWith(`${root}/`));
      const sourceKind: ScopedMetadata["sourceKind"] | null =
        note.type === "source" && note.status === "processed"
          ? "processed_source"
          : note.captureMarker === "web-v1"
            ? "raw_web_capture"
            : inInbox && (note.kind === "unmanaged" || note.type === "source")
              ? "raw_inbox"
              : note.type === "source"
                ? null
                : note.kind;
      if (!sourceKind) return [];
      if (request.purpose === "agent_context" && !allowed(note)) return [];
      const prior = sourceKind === "raw_inbox" || sourceKind === "raw_web_capture" ? 0 : authority(note);
      return [{ note, sourceKind, scopeReason, score: hit.lexicalScore * 10 + prior }];
    });
  const ranked = rank("and");
  if (!ranked.length) ranked.push(...rank("or"));
  ranked.sort(
    (a, b) =>
      (a.scopeReason === "primary_area" ? 0 : a.scopeReason === "related_areas" ? 1 : 2) -
        (b.scopeReason === "primary_area" ? 0 : b.scopeReason === "related_areas" ? 1 : 2) ||
      b.score - a.score ||
      (a.note.path < b.note.path ? -1 : a.note.path > b.note.path ? 1 : 0),
  );
  const metadata = (item: (typeof ranked)[number]): ScopedMetadata => ({
    entityId: item.note.entityId,
    path: item.note.path,
    hash: item.note.hash,
    title: item.note.title,
    type: item.note.type,
    status: item.note.status,
    agentAccess: item.note.agentAccess,
    sourceKind: item.sourceKind,
    scopeReason: item.scopeReason,
    trust: "untrusted_data",
  });
  if (request.purpose === "local_discovery")
    return {
      purpose: "local_discovery",
      vaultFingerprint: request.vaultFingerprint,
      indexRevision: revision,
      hits: ranked.slice(0, 10).map(metadata),
    };
  return {
    purpose: "agent_context",
    vaultFingerprint: request.vaultFingerprint,
    indexRevision: revision,
    hits: ranked.slice(0, 10).flatMap((item) => {
      const body = store.readAllowedContent(item.note.path, request.vaultFingerprint);
      return body === null ? [] : [{ ...metadata(item), text: Array.from(body).slice(0, 1200).join("") }];
    }),
  };
}

const firstParagraph = (body: string): string =>
  body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#")) ?? "";

const headedSection = (body: string, heading: string): string => {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`);
  if (start < 0) return "";
  const end = lines.findIndex((line, index) => index > start && /^##? /.test(line));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join("\n")
    .trim();
};

export function buildProjectContextPack(
  store: SqliteStore,
  projectId: string,
  access: AccessContext,
): ProjectContextPack {
  if (access.purpose !== "agent_context") throw new RetrievalError("RETRIEVAL-001", "Unsupported context purpose.");
  const revision = store.revision();
  if (!access.vaultFingerprint || access.vaultFingerprint !== store.vaultFingerprint())
    throw new RetrievalError("RETRIEVAL-001", "Wrong Vault fingerprint.");
  if (!revision || revision !== access.expectedRevision)
    throw new RetrievalError("RETRIEVAL-002", "Index revision is missing or stale.");
  const graph = traverseProject(store, projectId, (note) => allowed(note) && candidateSection(note) !== null);
  if (!allowed(graph.root)) throw new RetrievalError("RETRIEVAL-003", "Project is not eligible for agent context.");
  const sections: ProjectContextPack["sections"] = {
    projectSummary: [],
    currentState: [],
    goal: [],
    recentDecisions: [],
    relevantKnowledge: [],
    recentActivity: [],
    people: [],
    constraints: [],
    openQuestions: [],
  };
  let count = 0;
  let characters = 0;
  let omittedCount = graph.omittedNodeCount;
  let truncated = graph.truncated;
  const add = (section: keyof typeof sections, note: IndexedNote, text: string): void => {
    const value = text.trim();
    if (!value) return;
    if (count >= 10 || characters >= 12_000) {
      omittedCount++;
      truncated = true;
      return;
    }
    const codePoints = Array.from(value);
    const available = 12_000 - characters;
    const clipped = codePoints.slice(0, available).join("");
    if (codePoints.length > available) truncated = true;
    sections[section].push({
      text: clipped,
      trust: "untrusted_data",
      source: { entityId: note.entityId, path: note.path, hash: note.hash },
    });
    count++;
    characters += Array.from(clipped).length;
  };
  const rootBody = store.readAllowedContent(graph.root.path, access.vaultFingerprint);
  if (rootBody === null)
    throw new RetrievalError("RETRIEVAL-003", "Project content is not eligible for agent context.");
  add("projectSummary", graph.root, graph.root.title);
  add("currentState", graph.root, graph.root.status ?? "");
  add("goal", graph.root, firstParagraph(headedSection(rootBody, "Outcome") || headedSection(rootBody, "Goal")));
  add("constraints", graph.root, firstParagraph(headedSection(rootBody, "Constraints")));
  add("openQuestions", graph.root, firstParagraph(headedSection(rootBody, "Open Questions")));

  const lexical = new Set(store.search(graph.root.title).map((hit) => hit.path));
  const groups: Record<(typeof candidateSections)[number], IndexedNote[]> = {
    recentDecisions: [],
    relevantKnowledge: [],
    recentActivity: [],
    people: [],
  };
  for (const note of graph.nodes.filter((item) => item.path !== graph.root.path)) {
    const section = candidateSection(note);
    if (section) groups[section].push(note);
  }
  for (const section of candidateSections)
    groups[section].sort((a, b) => {
      if ((section === "recentDecisions" || section === "recentActivity") && a.activityAt !== b.activityAt)
        return (a.activityAt ?? "") > (b.activityAt ?? "") ? -1 : 1;
      return (
        Number(lexical.has(b.path)) * 10 + authority(b) - (Number(lexical.has(a.path)) * 10 + authority(a)) ||
        (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
      );
    });
  for (let position = 0; candidateSections.some((section) => position < groups[section].length); position++) {
    for (const section of candidateSections) {
      const note = groups[section][position];
      if (!note) continue;
      const body = store.readAllowedContent(note.path, access.vaultFingerprint);
      if (body !== null) add(section, note, firstParagraph(body) || note.title);
    }
  }
  return {
    kind: "project",
    projectId,
    vaultFingerprint: access.vaultFingerprint,
    indexRevision: revision,
    sections,
    omittedCount,
    truncated,
  };
}
