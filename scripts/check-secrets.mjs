import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// shortcut: common credential formats only; add a dedicated scanner before public release.
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
];

const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "buffer",
});
if (listed.status !== 0) throw new Error(listed.stderr.toString("utf8"));

const findings = [];
for (const name of listed.stdout.toString("utf8").split("\0").filter(Boolean)) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`Repository symlink is not scanned: ${name}`);
  if (!stat.isFile()) continue;
  const bytes = fs.readFileSync(file);
  if (bytes.includes(0)) continue;
  const text = bytes.toString("utf8");
  if (secretPatterns.some((pattern) => pattern.test(text))) findings.push(name);
}
if (findings.length) {
  console.error(`Potential secrets found in: ${findings.join(", ")}`);
  process.exitCode = 1;
} else console.log("No common credential patterns in repository files");
