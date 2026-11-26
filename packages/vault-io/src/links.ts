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
  | { kind: "wiki"; link: ExtractedLink; start: number; end: number }
  | { kind: "synthetic"; offset: number };

function* wikilinksInText(body: string, start: number, end: number, gaps: readonly number[]): Iterable<WikiToken> {
  const rawText = body.slice(start, end);
  for (const match of rawText.matchAll(/(!?)\[\[([^\]\r\n]+)\]\]/g)) {
    let precedingSlashes = 0;
    while (rawText[match.index - precedingSlashes - 1] === "\\") precedingSlashes++;
    if (precedingSlashes % 2 && match[1] !== "!") continue;
    const linkStart = start + match.index;
    const linkEnd = linkStart + match[0].length;
    if (gaps.some((gap) => gap > linkStart && gap < linkEnd)) {
      yield { kind: "synthetic", offset: linkStart + (match[1]?.length ?? 0) };
      continue;
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
        start: linkStart,
        end: linkEnd,
      };
  }
}

function* markdownNodes(node: Nodes): Iterable<Nodes> {
  yield node;
  if ("children" in node) for (const child of node.children) yield* markdownNodes(child);
}

type EvidenceMarkdown = { text: string; tree: Root; gaps: number[] };
type EvidenceEdit = { start: number; end: number; replacement: string };

function stripComments(body: string, edits: Iterable<EvidenceEdit>, previousGaps: readonly number[] = []) {
  const chunks: string[] = [];
  const gaps: number[] = [];
  let gapIndex = 0;
  let removed = 0;
  let cursor = 0;
  for (const { start, end, replacement } of edits) {
    for (let gap = previousGaps[gapIndex]; gap !== undefined && gap < end; gap = previousGaps[++gapIndex]) {
      if (gap < start) gaps.push(gap - removed);
    }
    chunks.push(body.slice(cursor, start), replacement);
    gaps.push(start - removed);
    removed += end - start - replacement.length;
    cursor = end;
  }
  for (const gap of previousGaps.slice(gapIndex)) gaps.push(gap - removed);
  return { text: chunks.length ? chunks.join("") + body.slice(cursor) : body, gaps };
}

function parseEvidenceMarkdown(body: string): EvidenceMarkdown {
  const comments = body.includes("%%") ? obsidianComments(body) : [];
  const obsidianVisible = stripComments(
    body,
    comments.map(({ start, end, block }) => ({
      start,
      end,
      replacement: block ? body.slice(start, end).replace(/[^\r\n]/g, "") : " ",
    })),
  );
  const tree = fromMarkdown(obsidianVisible.text);
  if (!obsidianVisible.text.includes("<!--")) return { ...obsidianVisible, tree };
  const htmlVisible = stripComments(
    obsidianVisible.text,
    htmlCommentEdits(tree, obsidianVisible.text),
    obsidianVisible.gaps,
  );
  return { ...htmlVisible, tree: htmlVisible.text === obsidianVisible.text ? tree : fromMarkdown(htmlVisible.text) };
}

function* inlineTextNodes(node: Nodes): Iterable<Text | null> {
  if (node.type === "text") yield node;
  else if (node.type === "emphasis" || node.type === "strong") {
    for (const child of node.children) yield* inlineTextNodes(child);
  } else yield null;
}

function* inlineWikiTokens(node: Nodes, text: string, gaps: readonly number[] = []): Iterable<WikiToken> {
  if (node.type !== "paragraph" && node.type !== "heading") return;
  let start: number | undefined;
  let end = 0;
  for (const child of node.children) {
    for (const leaf of inlineTextNodes(child)) {
      if (leaf?.position?.start.offset !== undefined && leaf.position.end.offset !== undefined) {
        start ??= leaf.position.start.offset;
        end = leaf.position.end.offset;
      } else {
        if (start !== undefined) yield* wikilinksInText(text, start, end, gaps);
        start = undefined;
      }
    }
  }
  if (start !== undefined) yield* wikilinksInText(text, start, end, gaps);
}

function* evidenceWikiTokens(node: Nodes, markdown: EvidenceMarkdown): Iterable<WikiToken> {
  for (const descendant of markdownNodes(node)) {
    yield* inlineWikiTokens(descendant, markdown.text, markdown.gaps);
  }
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

type WikiLabelCursor = { tokens: Extract<WikiToken, { kind: "wiki" }>[]; index: number };

function visibleLinkLabels(node: Text, source: string, labels?: WikiLabelCursor): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (!labels || start === undefined || end === undefined) return node.value;
  let text = "";
  let cursor = start;
  for (let token = labels.tokens[labels.index]; token && token.start < end; token = labels.tokens[++labels.index]) {
    if (token.end <= start) continue;
    if (token.start >= start) {
      const [target, heading] = token.link.target.split("#", 2);
      const basename = target?.split("/").at(-1)?.replace(/\.md$/i, "");
      const label = token.link.embed
        ? " "
        : (token.link.alias ?? [basename, heading?.startsWith("^") ? undefined : heading].filter(Boolean).join(" "));
      text += decodeMarkdownText(source.slice(cursor, token.start)) + decodeMarkdownText(label);
    }
    cursor = Math.min(token.end, end);
    if (token.end > end) break;
  }
  return cursor === start ? node.value : text + decodeMarkdownText(source.slice(cursor, end));
}

export function extractMarkdownDecisionSearch(body: string): { title: string | null; content: string } {
  const markdown = parseEvidenceMarkdown(body);
  const parts: string[] = [];
  let title: string | null = null;
  const searchText = (node: Nodes, enclosingLabels?: WikiLabelCursor): string => {
    if (node.type === "text") return visibleLinkLabels(node, markdown.text, enclosingLabels);
    if (node.type === "code" || node.type === "inlineCode") return node.value;
    if (node.type === "image" || node.type === "imageReference") return node.alt ?? "";
    if (node.type === "break") return "\n";
    if (!("children" in node)) return "";
    const labels =
      node.type === "paragraph" || node.type === "heading"
        ? {
            tokens: [...inlineWikiTokens(node, markdown.text, markdown.gaps)].filter((token) => token.kind === "wiki"),
            index: 0,
          }
        : enclosingLabels;
    const block = node.type === "blockquote" || node.type === "list" || node.type === "listItem";
    return node.children.map((child) => searchText(child, labels)).join(block ? "\n" : "");
  };
  for (const node of markdown.tree.children) {
    const text = searchText(node).trim();
    if (node.type === "heading" && text) title ??= text;
    if (text) parts.push(text);
  }
  return { title, content: parts.join("\n") };
}

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

function* syntheticWikiEdits(tokens: Iterable<WikiToken>): Iterable<EvidenceEdit> {
  for (const token of tokens) {
    if (token.kind === "synthetic") yield { start: token.offset, end: token.offset + 2, replacement: "\\[\\[" };
  }
}

export function extractMarkdownEvidenceText(body: string): string {
  if (!body.includes("%%") && !body.includes("<!--")) return body;
  const markdown = parseEvidenceMarkdown(body);
  return renderEvidenceText(
    markdown.text,
    0,
    markdown.text.length,
    syntheticWikiEdits(evidenceWikiTokens(markdown.tree, markdown)),
  );
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
    const tokens = [...evidenceWikiTokens(node, markdown)];
    edits.push(...syntheticWikiEdits(tokens));
    for (const token of tokens) {
      if (token.kind === "wiki" && !token.link.embed) wikiReferences.push(token.link.target);
    }
  }
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
  const links: { offset: number; link: ExtractedLink }[] = [];
  const definitions = new Map<string, string>();
  const collectDefinitions = (node: Nodes): void => {
    if (node.type === "definition" && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
    if ("children" in node) for (const child of node.children) collectDefinitions(child);
  };
  collectDefinitions(tree);

  const visit = (node: Nodes, parentType?: Nodes["type"]): void => {
    if (node.type === "heading") structure.headings.push({ level: node.depth, text: nodeText(node) });
    for (const token of inlineWikiTokens(node, body)) {
      if (token.kind === "wiki") links.push({ offset: token.start, link: token.link });
    }
    const appendLink = (link: ExtractedLink) => links.push({ offset: node.position?.start.offset ?? 0, link });
    if (node.type === "link") appendLink({ kind: "markdown", target: node.url, alias: nodeText(node), embed: false });
    if (node.type === "image")
      appendLink({
        kind: "markdown",
        target: node.url,
        ...(node.alt ? { alias: node.alt } : {}),
        embed: true,
      });
    if (node.type === "linkReference" || node.type === "imageReference") {
      const target = definitions.get(node.identifier);
      if (target)
        appendLink({
          kind: "markdown",
          target,
          alias: node.type === "imageReference" ? (node.alt ?? "") : nodeText(node),
          embed: node.type === "imageReference",
        });
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
  structure.links = links.sort((a, b) => a.offset - b.offset).map(({ link }) => link);
  for (const name of openAuto.keys()) structure.autoIssues.push(`unmatched AUTO begin: ${name}`);
  return structure;
}
