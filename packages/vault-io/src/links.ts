import type { Nodes, Root, Text } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { obsidianComments } from "./obsidian-comments.ts";

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

type WikiToken =
  | { kind: "wiki"; link: ExtractedLink; start: number | undefined; end: number | undefined }
  | { kind: "synthetic"; offset: number };

function* wikilinksInText(node: Text, body: string, gaps: readonly number[] = []): Iterable<WikiToken> {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  const rawText = start === undefined || end === undefined ? node.value : body.slice(start, end);
  for (const match of rawText.matchAll(/(!?)\[\[([^\]\r\n]+)\]\]/g)) {
    const precedingSlashes = rawText.slice(0, match.index).match(/\\+$/)?.[0].length ?? 0;
    if (precedingSlashes % 2 && match[1] !== "!") continue;
    if (start !== undefined) {
      const linkStart = start + match.index;
      if (gaps.some((gap) => gap > linkStart && gap < linkStart + match[0].length)) {
        yield { kind: "synthetic", offset: linkStart + (match[1]?.length ?? 0) };
        continue;
      }
    }
    const [target, alias] = (match[2] ?? "").split("|", 2);
    if (target)
      yield {
        kind: "wiki",
        link: {
          kind: "wiki",
          target,
          ...(alias ? { alias } : {}),
          embed: match[1] === "!" && precedingSlashes % 2 === 0,
        },
        start: start === undefined ? undefined : start + match.index,
        end: start === undefined ? undefined : start + match.index + match[0].length,
      };
  }
}

function* markdownNodes(node: Nodes): Iterable<Nodes> {
  yield node;
  if ("children" in node) for (const child of node.children) yield* markdownNodes(child);
}

type EvidenceMarkdown = { text: string; tree: Root; gaps: number[] };

function parseEvidenceMarkdown(body: string): EvidenceMarkdown {
  const chunks: string[] = [];
  const gaps: number[] = [];
  let removed = 0;
  let cursor = 0;
  const comments = body.includes("%%") ? obsidianComments(body) : [];
  for (const { start, end, block } of comments) {
    const replacement = block ? body.slice(start, end).replace(/[^\r\n]/g, "") : " ";
    chunks.push(body.slice(cursor, start), replacement);
    gaps.push(start - removed);
    removed += end - start - replacement.length;
    cursor = end;
  }
  const text = chunks.length ? chunks.join("") + body.slice(cursor) : body;
  return { text, tree: fromMarkdown(text), gaps };
}

function* evidenceWikiTokens(node: Nodes, markdown: EvidenceMarkdown): Iterable<WikiToken> {
  if (node.type === "link" || node.type === "linkReference") return;
  if (node.type === "text") yield* wikilinksInText(node, markdown.text, markdown.gaps);
  if ("children" in node) for (const child of node.children) yield* evidenceWikiTokens(child, markdown);
}

export function extractMarkdownWikiReferences(body: string): string[] {
  const markdown = parseEvidenceMarkdown(body);
  const references: string[] = [];
  for (const token of evidenceWikiTokens(markdown.tree, markdown)) {
    if (token.kind === "wiki" && !token.link.embed) references.push(token.link.target);
  }
  return references;
}

function decodeMarkdownText(text: string): string {
  return text.replace(
    /\\([!-/:-@[-`{-~])|&(?:#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi,
    (match, escaped?: string) => escaped ?? nodeText(fromMarkdown(match)),
  );
}

function visibleLinkLabels(node: Text, markdown: EvidenceMarkdown): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return node.value;
  let text = "";
  let cursor = start;
  for (const token of wikilinksInText(node, markdown.text, markdown.gaps)) {
    if (token.kind !== "wiki" || token.start === undefined || token.end === undefined) continue;
    const [target, heading] = token.link.target.split("#", 2);
    const basename = target?.split("/").at(-1)?.replace(/\.md$/i, "");
    const label = token.link.embed
      ? " "
      : (token.link.alias ?? [basename, heading?.startsWith("^") ? undefined : heading].filter(Boolean).join(" "));
    text += decodeMarkdownText(markdown.text.slice(cursor, token.start)) + decodeMarkdownText(label);
    cursor = token.end;
  }
  return cursor === start ? node.value : text + decodeMarkdownText(markdown.text.slice(cursor, end));
}

export function extractMarkdownDecisionSearch(body: string): { title: string | null; content: string } {
  const markdown = parseEvidenceMarkdown(body);
  const parts: string[] = [];
  let title: string | null = null;
  const searchText = (node: Nodes): string => {
    if (node.type === "text") return visibleLinkLabels(node, markdown);
    if (node.type === "code" || node.type === "inlineCode") return node.value;
    if (node.type === "image" || node.type === "imageReference") return node.alt ?? "";
    if (node.type === "break") return "\n";
    if (!("children" in node)) return "";
    const block = node.type === "blockquote" || node.type === "list" || node.type === "listItem";
    return node.children.map(searchText).join(block ? "\n" : "");
  };
  for (const node of markdown.tree.children) {
    const text = searchText(node).trim();
    if (node.type === "heading" && text) title ??= text;
    if (text) parts.push(text);
  }
  return { title, content: parts.join("\n") };
}

type EvidenceEdit = { start: number; end: number; replacement: string };

function* htmlCommentEdits(root: Nodes, text: string): Iterable<EvidenceEdit> {
  for (const node of markdownNodes(root)) {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (node.type !== "html" || start === undefined || end === undefined) continue;
    for (const match of text.slice(start, end).matchAll(/<!--[\s\S]*?(?:-->|$)/g)) {
      const offset = start + match.index;
      yield {
        start: offset,
        end: offset + match[0].length,
        replacement: match[0].match(/\r\n|\r|\n/)?.[0] ?? " ",
      };
    }
  }
}

function renderEvidenceText(text: string, start: number, end: number, edits: Iterable<EvidenceEdit>): string {
  let visible = "";
  let cursor = start;
  for (const edit of edits) {
    visible += text.slice(cursor, edit.start) + edit.replacement;
    cursor = edit.end;
  }
  return visible + text.slice(cursor, end);
}

export function extractMarkdownEvidenceText(body: string): string {
  if (!body.includes("%%") && !body.includes("<!--")) return body;
  const { text, tree } = parseEvidenceMarkdown(body);
  return renderEvidenceText(text, 0, text.length, htmlCommentEdits(tree, text));
}

export function extractMarkdownSection(
  body: string,
  heading: string,
): { heading: string; text: string; wikiReferences: string[] } | null {
  const markdown = parseEvidenceMarkdown(body);
  const { children } = markdown.tree;
  const index = children.findIndex(
    (node) => node.type === "heading" && node.depth === 2 && nodeText(node).toLowerCase() === heading.toLowerCase(),
  );
  const start = children[index];
  if (start?.type !== "heading" || start.position?.end.offset === undefined) return null;
  const wikiReferences: string[] = [];
  const edits: EvidenceEdit[] = [];
  // The whole-note tree retains references to Markdown link definitions outside the section.
  let endOffset = markdown.text.length;
  for (const node of children.slice(index + 1)) {
    if (node.type === "heading" && node.depth <= start.depth) {
      endOffset = node.position?.start.offset ?? endOffset;
      break;
    }
    for (const edit of htmlCommentEdits(node, markdown.text)) edits.push(edit);
    for (const token of evidenceWikiTokens(node, markdown)) {
      if (token.kind === "synthetic") {
        edits.push({ start: token.offset, end: token.offset + 2, replacement: "\\[\\[" });
      } else if (!token.link.embed) wikiReferences.push(token.link.target);
    }
  }
  edits.sort((a, b) => a.start - b.start);
  return {
    heading: nodeText(start),
    text: renderEvidenceText(markdown.text, start.position.end.offset, endOffset, edits),
    wikiReferences,
  };
}

export function extractMarkdownStructure(body: string): MarkdownStructure {
  const structure: MarkdownStructure = { headings: [], links: [], fences: [], autoSections: [], autoIssues: [] };
  const lines = body.split(/\r?\n/);
  const openAuto = new Map<string, number>();
  const openOrder: string[] = [];
  const seenAuto = new Set<string>();
  const tree = fromMarkdown(body);
  const definitions = new Map<string, string>();
  const collectDefinitions = (node: Nodes): void => {
    if (node.type === "definition" && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
    if ("children" in node) for (const child of node.children) collectDefinitions(child);
  };
  collectDefinitions(tree);

  const visit = (node: Nodes, parentType?: Nodes["type"]): void => {
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
      for (const token of wikilinksInText(node, body)) if (token.kind === "wiki") structure.links.push(token.link);
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
    // A marker owns content only when the entire top-level HTML node is one comment line.
    if (node.type === "html" && parentType === "root" && node.position) {
      const match = node.value.trim().match(/^<!-- (BEGIN|END) AUTO:([a-zA-Z0-9_-]+) -->$/);
      const line = node.position.start.line;
      if (match && node.position.start.line === node.position.end.line && lines[line - 1]?.trim() === match[0]) {
        const name = match[2];
        if (name && match[1] === "BEGIN") {
          if (seenAuto.has(name) || openAuto.has(name)) structure.autoIssues.push(`duplicate AUTO marker: ${name}`);
          else {
            openAuto.set(name, line);
            openOrder.push(name);
          }
        } else if (name) {
          const begin = openAuto.get(name);
          if (begin === undefined) structure.autoIssues.push(`unmatched AUTO end: ${name}`);
          else if (openOrder.at(-1) !== name) structure.autoIssues.push(`mismatched AUTO end: ${name}`);
          else {
            structure.autoSections.push({ name, begin, end: line });
            seenAuto.add(name);
            openAuto.delete(name);
            openOrder.pop();
          }
        }
      }
    }
    if ("children" in node) for (const child of node.children) visit(child, node.type);
  };

  visit(tree);
  for (const name of openAuto.keys()) structure.autoIssues.push(`unmatched AUTO begin: ${name}`);
  return structure;
}
