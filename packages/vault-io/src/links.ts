import type { Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";

export type ExtractedLink = {
  kind: "wiki" | "markdown";
  target: string;
  alias?: string;
  embed: boolean;
};

export type MarkdownStructure = {
  headings: { level: number; text: string }[];
  links: ExtractedLink[];
  fences: { line: number; boundary: "open" | "close" }[];
  autoSections: { name: string; begin: number; end: number }[];
  autoIssues: string[];
};

function nodeText(node: Nodes): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  return "children" in node ? node.children.map(nodeText).join("") : "";
}

export function extractMarkdownStructure(body: string): MarkdownStructure {
  const structure: MarkdownStructure = { headings: [], links: [], fences: [], autoSections: [], autoIssues: [] };
  const lines = body.split(/\r?\n/);
  const openAuto = new Map<string, number>();
  const seenAuto = new Set<string>();
  const tree = fromMarkdown(body);
  const definitions = new Map<string, string>();
  const collectDefinitions = (node: Nodes): void => {
    if (node.type === "definition" && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
    if ("children" in node) for (const child of node.children) collectDefinitions(child);
  };
  collectDefinitions(tree);

  const visit = (node: Nodes): void => {
    if (node.type === "heading") structure.headings.push({ level: node.depth, text: nodeText(node) });
    if (node.type === "link")
      structure.links.push({ kind: "markdown", target: node.url, alias: nodeText(node), embed: false });
    if (node.type === "image")
      structure.links.push({
        kind: "markdown",
        target: node.url,
        ...(node.alt ? { alias: node.alt } : {}),
        embed: true,
      });
    if (node.type === "linkReference" || node.type === "imageReference") {
      const target = definitions.get(node.identifier);
      if (target)
        structure.links.push({
          kind: "markdown",
          target,
          alias: node.type === "imageReference" ? (node.alt ?? "") : nodeText(node),
          embed: node.type === "imageReference",
        });
    }
    if (node.type === "text") {
      for (const match of node.value.matchAll(/(!?)\[\[([^\]\r\n]+)\]\]/g)) {
        const [target, alias] = (match[2] ?? "").split("|", 2);
        if (target)
          structure.links.push({ kind: "wiki", target, ...(alias ? { alias } : {}), embed: match[1] === "!" });
      }
    }
    if (node.type === "code" && node.position) {
      const { start, end } = node.position;
      const opening = lines[start.line - 1]?.match(/^ {0,3}(`{3,}|~{3,})/);
      if (opening) {
        structure.fences.push({ line: start.line, boundary: "open" });
        const closing = lines[end.line - 1]?.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
        if (closing?.[1] && closing[1][0] === opening[1]?.[0] && closing[1].length >= (opening[1]?.length ?? 0))
          structure.fences.push({ line: end.line, boundary: "close" });
      }
    }
    if (node.type === "html" && node.position) {
      for (const match of node.value.matchAll(/<!-- (BEGIN|END) AUTO:([a-zA-Z0-9_-]+) -->/g)) {
        const name = match[2];
        if (!name) continue;
        const line = node.position.start.line + (node.value.slice(0, match.index).match(/\n/g) ?? []).length;
        if (match[1] === "BEGIN") {
          if (seenAuto.has(name) || openAuto.has(name)) structure.autoIssues.push(`duplicate AUTO marker: ${name}`);
          else openAuto.set(name, line);
        } else {
          const begin = openAuto.get(name);
          if (begin === undefined) structure.autoIssues.push(`unmatched AUTO end: ${name}`);
          else {
            structure.autoSections.push({ name, begin, end: line });
            seenAuto.add(name);
            openAuto.delete(name);
          }
        }
      }
    }
    if ("children" in node) for (const child of node.children) visit(child);
  };

  visit(tree);
  for (const name of openAuto.keys()) structure.autoIssues.push(`unmatched AUTO begin: ${name}`);
  return structure;
}
