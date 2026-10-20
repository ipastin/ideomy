import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BetterSqliteStore } from "../packages/index/src/index.ts";
import { buildProjectContextPack, retrieveScoped } from "../packages/retrieval/src/index.ts";

type Case = {
  id: string;
  kind?: string;
  query?: string;
  fallback_query?: string;
  authority_query?: string;
  metric: string;
  expected_ids?: string[];
  excluded_ids?: string[];
  project_id?: string;
  area_id?: string;
  expected_primary_path?: string;
  expected_related_path?: string;
  expected_path?: string;
  expected_kinds?: Record<string, string>;
  excluded_paths?: string[];
  confirmed_inbox_root?: string;
  expected_first_path?: string;
  expected_paths?: string[];
  expected_local_paths?: string[];
  expected_agent_path?: string;
  excluded_path?: string;
  expected_omitted_count?: number;
  expected_relevant_count?: number;
  eligible_neighbors?: number;
  restricted_neighbors?: number;
};

const root = path.resolve(import.meta.dirname, "..");
const fixtureRoot = path.join(root, "fixtures/test-vault");
const cases = readFileSync(path.join(root, "evals/golden/retrieval.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as Case);
const thresholds = JSON.parse(readFileSync(path.join(root, "evals/thresholds.json"), "utf8")) as {
  hard_gates: {
    critical_auth_or_vault_isolation_failures: number;
    critical_privacy_policy_failures: number;
  };
  quality_gates: {
    exact_entity_lookup_accuracy_min: number;
    decision_why_recall_at_5_min: number;
    project_context_key_item_recall_at_10_min: number;
  };
};
const project = "10 Projects/Build Ideomy v1.md";
const knowledge = "20 Knowledge/Primary Area Is Determined by Intent.md";
const decision = "40 Decisions/2026-10-03 — Use External Personal Vault.md";
const source = "21 Sources/Article — Intent and Information Architecture.md";
const journal = "60 Journal/Daily/2026-10-06.md";
const localOnly = "20 Knowledge/Private Local Only.md";
const unmanaged = "20 Knowledge/Unmanaged Existing Note.md";
const projectId = "prj_01M4K11NG0XKJFG87XA758PBH3";
const fingerprint = "synthetic-eval-vault";
const seedFiles = [
  project,
  knowledge,
  decision,
  source,
  journal,
  localOnly,
  unmanaged,
  "00 System/Areas/Technology & AI.md",
  "00 System/Areas/Self & Direction.md",
  "11 Goals/Build Reliable Personal Knowledge System.md",
  "30 People/Alex Example.md",
  "41 Meetings/2026-10-04 — Architecture Review — Alex Example.md",
];

function put(vault: string, file: string, text: string): void {
  const destination = path.join(vault, file);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, text);
}
function read(vault: string, file: string): string {
  return readFileSync(path.join(vault, file), "utf8");
}
function fixture(vault: string, file: string): void {
  const destination = path.join(vault, file);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(fixtureRoot, file), destination);
}
const failures: string[] = [];
function requireCase(ok: boolean, id: string, reason: string): void {
  if (!ok) failures.push(`${id}: ${reason}`);
}
function prepareBase(vault: string): void {
  for (const file of seedFiles) fixture(vault, file);
  put(vault, project, `${read(vault, project)}\n[[Article — Intent and Information Architecture]]\n[[2026-10-06]]\n`);
  put(vault, journal, read(vault, journal).replace("agent_access: restricted", "agent_access: allowed"));
  for (const file of ["30 People/Alex Example.md", "41 Meetings/2026-10-04 — Architecture Review — Alex Example.md"])
    put(vault, file, `${read(vault, file)}\nархитектурном review\n`);
  put(
    vault,
    "20 Knowledge/Related Ideomy Note.md",
    read(vault, knowledge)
      .replace("kn_01M4K11NG0P7VQFQ3Z69M6XACE", "kn_01M4K11NG0P7VQFQ3Z69M6XACF")
      .replace('primary_area: "[[Technology & AI]]"', 'primary_area: "[[Self & Direction]]"')
      .replace("related_areas: []", 'related_areas: ["[[Technology & AI]]"]')
      .replaceAll("Primary Area Is Determined by Intent", "Related Ideomy Note"),
  );
  put(
    vault,
    "20 Knowledge/Technology & AI Unmanaged.md",
    "# Technology & AI Unmanaged\nareaunmanagedprobe [[Technology & AI]]\n",
  );
  const clip = readFileSync(path.join(fixtureRoot, "01 Inbox/Web/Synthetic Browser Capture.md"), "utf8");
  put(vault, "Web Outside/Synthetic Clip.md", `${clip}\nrawsourceprobe\n`);
  put(vault, "01 Inbox/Manual Capture.md", "# Manual Capture\nrawsourceprobe\n");
  put(vault, "Loose Inbox/Unconfirmed Capture.md", "# Unconfirmed Capture\nrawsourceprobe\n");
  put(
    vault,
    "21 Sources/Processed Probe.md",
    `${read(vault, source)
      .replace("src_01M4K11NG0NDHTPH14Y312K8SW", "src_01M4K11NG0NDHTPH14Y312K8SX")
      .replaceAll("Article — Intent and Information Architecture", "Processed Probe")}\nrawsourceprobe\n`,
  );
  put(
    vault,
    "21 Sources/Unprocessed Probe.md",
    `${read(vault, source)
      .replace("src_01M4K11NG0NDHTPH14Y312K8SW", "src_01M4K11NG0NDHTPH14Y312K8SY")
      .replace("status: processed", "status: inbox")
      .replaceAll("Article — Intent and Information Architecture", "Unprocessed Probe")}\nrawsourceprobe\n`,
  );
  put(
    vault,
    "20 Knowledge/Квантовая стратегия.md",
    read(vault, knowledge)
      .replace("kn_01M4K11NG0P7VQFQ3Z69M6XACE", "kn_01M4K11NG0P7VQFQ3Z69M6XACG")
      .replaceAll("Primary Area Is Determined by Intent", "Квантовая стратегия"),
  );
  put(vault, decision, `${read(vault, decision)}\nстратегия\n`);
  put(vault, knowledge, `${read(vault, knowledge)}\nprivacyprobe\n`);
  put(vault, localOnly, `${read(vault, localOnly)}\nprivacyprobe\n`);
  put(vault, unmanaged, `${read(vault, unmanaged)}\nprivacyprobe\n`);
  put(
    vault,
    "40 Decisions/Denied Privacy Probe.md",
    `${read(vault, decision)
      .replace("dec_01M4K11NG0VEB0JAS3F501V9XB", "dec_01M4K11NG0VEB0JAS3F501V9XC")
      .replace("agent_access: allowed", "agent_access: denied")
      .replaceAll("Use External Personal Vault", "Denied Privacy Probe")}\nprivacyprobe\n`,
  );
  for (const file of ["21 Sources/Processed Probe.md", journal, "01 Inbox/Manual Capture.md"])
    put(vault, file, `${read(vault, file)}\nrankingprobe\n`);
}

function runBoundedCase(item: Case, directory: string): void {
  const vault = path.join(directory, "bound-vault");
  fixture(vault, project);
  const seed = readFileSync(path.join(fixtureRoot, knowledge), "utf8");
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const restricted = item.restricted_neighbors ?? 0;
  const total = restricted + (item.eligible_neighbors ?? 0);
  if (!total || total > 1024) throw new Error(`${item.id}: invalid neighbor count`);
  for (let i = 0; i < total; i++) {
    const name = `${i < restricted ? "Restricted" : "Eligible"} ${String(i).padStart(2, "0")}`;
    const id = `kn_01M4K11NG0P7VQFQ3Z69M6XA${alphabet[Math.floor(i / 32)]}${alphabet[i % 32]}`;
    const content = seed
      .replace("kn_01M4K11NG0P7VQFQ3Z69M6XACE", id)
      .replaceAll("Primary Area Is Determined by Intent", name);
    put(
      vault,
      `${i < restricted ? "00 Restricted" : "20 Knowledge"}/${name}.md`,
      i < restricted ? content.replace("agent_access: allowed", "agent_access: restricted") : content,
    );
  }
  const store = new BetterSqliteStore(path.join(directory, "bound.sqlite"));
  try {
    const revision = store.rebuild({ vaultRoot: vault, vaultId: "synthetic-bound", vaultFingerprint: fingerprint });
    const pack = buildProjectContextPack(store, item.project_id ?? projectId, {
      purpose: "agent_context",
      vaultFingerprint: fingerprint,
      expectedRevision: revision,
    });
    requireCase(pack.omittedCount === item.expected_omitted_count, item.id, "wrong omitted count");
    requireCase(
      pack.sections.relevantKnowledge.length === item.expected_relevant_count,
      item.id,
      "wrong relevant count",
    );
  } finally {
    store.close();
  }
}

function run(): void {
  const directory = mkdtempSync(path.join(tmpdir(), "ideomy-retrieval-evals-"));
  const vault = path.join(directory, "vault");
  let exactCorrect = 0,
    exactTotal = 0,
    whyFound = 0,
    whyExpected = 0;
  let searchFound = 0,
    searchExpected = 0,
    packFound = 0,
    packExpected = 0;
  let vaultFailures = 0,
    privacyFailures = 0;
  const passed: string[] = [];
  try {
    prepareBase(vault);
    const store = new BetterSqliteStore(path.join(directory, "index.sqlite"));
    try {
      const revision = store.rebuild({ vaultRoot: vault, vaultId: "synthetic", vaultFingerprint: fingerprint });
      const request = { vaultFingerprint: fingerprint, expectedRevision: revision };
      const local = (
        query: string,
        scope: { kind: "unscoped" } | { kind: "area"; areaId: string } = { kind: "unscoped" },
        confirmedInboxRoot?: string,
      ) =>
        retrieveScoped(store, {
          ...request,
          purpose: "local_discovery",
          query,
          scope,
          ...(confirmedInboxRoot === undefined ? {} : { confirmedInboxRoot }),
        });
      if (new Set(cases.map((item) => item.id)).size !== cases.length)
        throw new Error("Golden case IDs must be unique.");
      for (const item of cases) {
        if (!item.id || !item.metric) throw new Error("Golden case is missing id or metric.");
        const before = failures.length;
        const kind = item.kind ?? "search";
        if (kind === "search") {
          const hits = local(item.query ?? "").hits.slice(0, 5);
          const ids = new Set(hits.map((hit) => hit.entityId));
          const found = (item.expected_ids ?? []).filter((id) => ids.has(id)).length;
          requireCase(found === item.expected_ids?.length, item.id, "expected search ID absent from top 5");
          searchFound += found;
          searchExpected += item.expected_ids?.length ?? 0;
          if (item.metric === "decision_why_recall@5") {
            whyFound += found;
            whyExpected += item.expected_ids?.length ?? 0;
          }
        } else if (kind === "exact_lookup") {
          exactTotal++;
          const result = store.lookupExact(item.query ?? "");
          if (result.status === "found" && result.note.entityId === item.expected_ids?.[0]) exactCorrect++;
          requireCase(
            result.status === "found" && result.note.entityId === item.expected_ids?.[0],
            item.id,
            "exact lookup mismatch",
          );
        } else if (kind === "project_pack" || kind === "project_pack_source_journal") {
          const pack = buildProjectContextPack(store, item.project_id ?? projectId, {
            purpose: "agent_context",
            ...request,
          });
          const ids = new Set(
            Object.values(pack.sections)
              .flat()
              .map((hit) => hit.source.entityId),
          );
          const found = (item.expected_ids ?? []).filter((id) => ids.has(id)).length;
          requireCase(found === item.expected_ids?.length, item.id, "Pack key item absent");
          for (const id of item.excluded_ids ?? []) {
            if (ids.has(id)) privacyFailures++;
            requireCase(!ids.has(id), item.id, `excluded Pack item ${id} exposed`);
          }
          packFound += found;
          packExpected += item.expected_ids?.length ?? 0;
        } else if (kind === "project_pack_graph_bound") {
          runBoundedCase(item, directory);
        } else if (kind === "area_tiers") {
          const hits = local(item.query ?? "", { kind: "area", areaId: item.area_id ?? "" }).hits;
          const primary = hits.findIndex(
            (hit) => hit.path === item.expected_primary_path && hit.scopeReason === "primary_area",
          );
          const related = hits.findIndex(
            (hit) => hit.path === item.expected_related_path && hit.scopeReason === "related_areas",
          );
          requireCase(primary >= 0 && related > primary, item.id, "primary/related Area tiers mismatch");
        } else if (kind === "unmanaged_scope") {
          const unscoped = local(item.query ?? "").hits;
          const scoped = local(item.query ?? "", { kind: "area", areaId: item.area_id ?? "" }).hits;
          requireCase(
            unscoped.some((hit) => hit.path === item.expected_path && hit.entityId === null),
            item.id,
            "unmanaged note absent",
          );
          requireCase(!scoped.some((hit) => hit.path === item.expected_path), item.id, "unmanaged note acquired Area");
        } else if (kind === "invalid_area") {
          for (const areaId of ["", "area_01M4K11NG0RJRCDC6QME082AGZ"]) {
            let rejected = false;
            try {
              local(item.query ?? "", { kind: "area", areaId });
            } catch (error) {
              rejected = error instanceof Error && "code" in error && error.code === "RETRIEVAL-004";
            }
            requireCase(rejected, item.id, `Area scope ${areaId || "empty"} did not fail closed`);
          }
        } else if (kind === "raw_source_classification") {
          const hits = local(item.query ?? "", { kind: "unscoped" }, item.confirmed_inbox_root).hits;
          for (const [file, expected] of Object.entries(item.expected_kinds ?? {}))
            requireCase(
              hits.some((hit) => hit.path === file && hit.sourceKind === expected),
              item.id,
              `${file} classified incorrectly`,
            );
          for (const file of item.excluded_paths ?? []) {
            const exposed = hits.some((hit) => hit.path === file);
            if (exposed) privacyFailures++;
            requireCase(!exposed, item.id, `${file} unexpectedly included`);
          }
          const withoutRoot = local(item.query ?? "").hits;
          requireCase(
            withoutRoot.some((hit) => hit.path === "01 Inbox/Manual Capture.md" && hit.sourceKind === "unmanaged"),
            item.id,
            "unconfirmed root inferred",
          );
        } else if (kind === "unicode_lexical") {
          requireCase(
            local(item.query ?? "").hits[0]?.path === item.expected_first_path,
            item.id,
            "Unicode AND ranking mismatch",
          );
          requireCase(
            local(item.fallback_query ?? "").hits[0]?.path === item.expected_first_path,
            item.id,
            "Unicode OR fallback mismatch",
          );
          requireCase(
            local(item.authority_query ?? "").hits[0]?.path === item.expected_first_path,
            item.id,
            "lexical relevance did not beat authority",
          );
        } else if (kind === "authority_prior") {
          const paths = local(item.query ?? "", { kind: "unscoped" }, item.confirmed_inbox_root).hits.map(
            (hit) => hit.path,
          );
          const positions = (item.expected_paths ?? []).map((file) => paths.indexOf(file));
          requireCase(
            positions.every(
              (position, index) => position >= 0 && (index === 0 || position > (positions[index - 1] ?? -1)),
            ),
            item.id,
            "authority prior order mismatch",
          );
        } else if (kind === "policy_fallback") {
          const hits = local(item.query ?? "").hits;
          requireCase(
            hits.some((hit) => hit.path === item.expected_path),
            item.id,
            "OR fallback missed eligible item",
          );
          const deniedExposed = hits.some((hit) => hit.path === item.excluded_path);
          if (deniedExposed) privacyFailures++;
          requireCase(!deniedExposed, item.id, "denied item exposed");
        } else if (kind === "purpose_privacy") {
          const discovery = local(item.query ?? "");
          const agent = retrieveScoped(store, {
            ...request,
            purpose: "agent_context",
            query: item.query ?? "",
            scope: { kind: "unscoped" },
          });
          const localPaths = new Set(discovery.hits.map((hit) => hit.path));
          const agentPaths = new Set(agent.hits.map((hit) => hit.path));
          const okay =
            (item.expected_local_paths ?? []).every((file) => localPaths.has(file)) &&
            agentPaths.has(item.expected_agent_path ?? "") &&
            (item.expected_local_paths ?? []).every((file) => !agentPaths.has(file)) &&
            !localPaths.has(item.excluded_path ?? "") &&
            !agentPaths.has(item.excluded_path ?? "") &&
            discovery.hits.every((hit) => !("text" in hit)) &&
            agent.hits.every((hit) => typeof hit.text === "string");
          if (!okay) privacyFailures++;
          requireCase(okay, item.id, "purpose or privacy policy mismatch");
        } else if (kind === "vault_revision") {
          for (const [changed, expectedCode] of [
            [{ vaultFingerprint: "wrong" }, "RETRIEVAL-001"],
            [{ expectedRevision: "stale" }, "RETRIEVAL-002"],
          ] as const) {
            let rejected = false;
            try {
              retrieveScoped(store, {
                ...request,
                ...changed,
                purpose: "local_discovery",
                query: item.query ?? "",
                scope: { kind: "unscoped" },
              });
            } catch (error) {
              rejected = error instanceof Error && "code" in error && error.code === expectedCode;
            }
            if (!rejected) vaultFailures++;
          }
          requireCase(vaultFailures === 0, item.id, "wrong Vault or stale revision returned");
        } else throw new Error(`${item.id}: unknown kind ${kind}`);
        if (failures.length === before) passed.push(item.id);
      }
    } finally {
      store.close();
    }
    if (!exactTotal || !whyExpected || !packExpected || !searchExpected)
      throw new Error("A metric denominator is zero.");
    const metrics = {
      exact_entity_lookup_accuracy: {
        numerator: exactCorrect,
        denominator: exactTotal,
        value: exactCorrect / exactTotal,
      },
      decision_why_recall_at_5: { numerator: whyFound, denominator: whyExpected, value: whyFound / whyExpected },
      project_context_key_item_recall_at_10: {
        numerator: packFound,
        denominator: packExpected,
        value: packFound / packExpected,
      },
      seed_search_recall_at_5: {
        numerator: searchFound,
        denominator: searchExpected,
        value: searchFound / searchExpected,
      },
      critical_auth_or_vault_isolation_failures: vaultFailures,
      critical_privacy_policy_failures: privacyFailures,
    };
    const checks = [
      metrics.exact_entity_lookup_accuracy.value >= thresholds.quality_gates.exact_entity_lookup_accuracy_min,
      metrics.decision_why_recall_at_5.value >= thresholds.quality_gates.decision_why_recall_at_5_min,
      metrics.project_context_key_item_recall_at_10.value >=
        thresholds.quality_gates.project_context_key_item_recall_at_10_min,
      vaultFailures <= thresholds.hard_gates.critical_auth_or_vault_isolation_failures,
      privacyFailures <= thresholds.hard_gates.critical_privacy_policy_failures,
    ];
    const report = {
      cases: { passed: passed.length, total: cases.length, ids: passed, failures },
      metrics,
      thresholdsFile: "evals/thresholds.json",
      applicableThresholdsPassed: checks.every(Boolean) && failures.length === 0,
      notRun: [
        "other subsystem hard gates",
        "ask_provenance_coverage_min",
        "classification and entity resolution quality gates",
      ],
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!checks.every(Boolean) || failures.length || passed.length !== cases.length) process.exitCode = 1;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

run();
