import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { isRegularRepositoryFile } from "./check-secrets.mjs";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ideomy-secrets-"));
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));

describe("secret scan file entries", () => {
  it("rejects a dangling symlink before testing its target", () => {
    const link = path.join(directory, "missing-link");
    fs.symlinkSync(path.join(directory, "missing-target"), link);
    expect(() => isRegularRepositoryFile(link, "missing-link")).toThrow(/symlink/);
  });

  it("ignores a removed tracked file and accepts a regular file", () => {
    expect(isRegularRepositoryFile(path.join(directory, "removed"), "removed")).toBe(false);
    const file = path.join(directory, "synthetic.txt");
    fs.writeFileSync(file, "synthetic");
    expect(isRegularRepositoryFile(file, "synthetic.txt")).toBe(true);
  });
});
