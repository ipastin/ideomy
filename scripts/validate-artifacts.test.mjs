import { describe, expect, it } from "vitest";
import { fixtureFrontmatter } from "./validate-artifacts.mjs";

describe("synthetic fixture frontmatter", () => {
  it("parses LF and CRLF delimiters equally", () => {
    expect(fixtureFrontmatter("---\ntype: project\n---\nBody", "note.md")).toBe("type: project");
    expect(fixtureFrontmatter("---\r\ntype: project\r\n---\r\nBody", "note.md")).toBe("type: project");
  });

  it("still rejects unclosed frontmatter", () => {
    expect(() => fixtureFrontmatter("---\r\ntype: project", "note.md")).toThrow(/unclosed frontmatter/);
  });
});
