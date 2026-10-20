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
