import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BetterSqliteStore } from "../packages/index/src/index.ts";
import {
  buildProjectContextPack,
  type PackItem,
  retrieveProjectDecisionEvidence,
  retrieveScoped,
} from "../packages/retrieval/src/index.ts";

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
  decision_context?: string;
  basis?: string;
  target?: SyntheticDecision;
  distractors?: SyntheticDecision[];
  expected_why?: string;
  expected_revisit?: string;
  expected_measurement?: string;
};

type SyntheticDecision = { id: string; title: string; rationale: string };

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
  put(
    vault,
    project,
    `${read(vault, project).replace("status: active", 'status: active\naliases: ["Ideomy Blueprint"]')}\n[[Article — Intent and Information Architecture]]\n[[2026-10-06]]\n`,
  );
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
  put(vault, "20 Knowledge/Hangul Unicode.md", "# 가\n나\n");
  put(vault, "20 Knowledge/Résumé.md", "# Résumé\n");
  put(vault, decision, `${read(vault, decision)}\nстратегия resume\n`);
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
  const decisionIds = new Set<string>();
  for (const item of cases) {
    if (!item.target) continue;
    if (
      item.metric !== "decision_why_recall@5" ||
      item.expected_ids?.length !== 1 ||
      item.expected_ids[0] !== item.target.id ||
      !item.decision_context ||
      !item.basis ||
      item.distractors?.length !== 5
    )
      throw new Error(`${item.id}: invalid Decision why candidates`);
    for (const [index, candidate] of [item.target, ...item.distractors].entries()) {
      if (!candidate.id || !candidate.title || !candidate.rationale || decisionIds.has(candidate.id))
        throw new Error(`${item.id}: invalid or duplicate Decision candidate`);
      decisionIds.add(candidate.id);
      put(
        vault,
        `40 Decisions/${index ? "AA" : "ZZ"} ${candidate.id}.md`,
        `---\nideomy_schema: 1\nid: ${candidate.id}\ntype: decision\nstatus: accepted\ndate: 2026-10-03\nprimary_area: "[[Technology & AI]]"\ncreated: 2026-10-03T09:00:00+03:00\nupdated: 2026-10-03T09:00:00+03:00\nsensitivity: internal\nagent_access: allowed\n---\n# ${candidate.title}\n\nContext: ${item.decision_context}\n\n## Why\n${candidate.rationale}\n`,
      );
    }
  }
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

function runProjectDecisionCase(item: Case, directory: string): void {
  const vault = path.join(directory, item.id);
  const suffix = "__created-26-11-26_10-07-06__v1.0.0__test(pilot)__updated-26-11-26_10-07-06";
  const link = (title: string) => `[[${title}${suffix}]]`;
  const writeNote = (
    title: string,
    type: "project" | "decision" | "record",
    sequence: string,
    status: string,
    body: string | null,
    properties: Record<string, unknown> = {},
  ) => {
    const [folder, prefix] = {
      project: ["10 Projects", "prj"],
      decision: ["40 Decisions", "dec"],
      record: ["43 Records", "rec"],
    }[type];
    const metadata = {
      ideomy_schema: 1,
      id: `${prefix}_01M4K11NG0XKJFG87XA758PB${sequence}`,
      type,
      status,
      primary_area: null,
      created: "2026-11-26T10:07:06+03:00",
      updated: "2026-11-26T10:07:06+03:00",
      sensitivity: "internal",
      agent_access: "allowed",
      artifact_created: "26-11-26 10-07-06",
      artifact_updated: "26-11-26 10-07-06",
      version: "1.0.0",
      commit: "test(retrieval): cover synthetic project decision evidence",
      ...properties,
    };
    const yaml = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n");
    const file = `${folder}/${title}${suffix}.md`;
    const markdown = body === null ? "\n" : `# ${title}\n\n${body}\n`;
    put(vault, file, `---\n${yaml}\n---\n${markdown}`);
    return file;
  };
  const mayak = "Маяк — возвраты";
  const north = "Север — возвраты";
  const measurement = "Маяк — сверка идентификаторов";
  const outsideWhy = "Маяк — посторонняя сверка";
  const denied = "Маяк — закрытая сверка";
  const unverified = "Маяк — черновая сверка";
  const empty = "Маяк — сверка без измерений";
  const hidden = "Скрытая черновая причина";
  const acceptedTitle = "Маяк — отложить API интеграцию";
  const date = "2026-11-20";
  writeNote(mayak, "project", "01", "active", "## Outcome\nПилот в пяти магазинах.", {
    outcome: "Пилот в пяти магазинах",
  });
  writeNote(north, "project", "02", "active", "## Outcome\nПилот на складе.", { outcome: "Пилот на складе" });
  const accepted = writeNote(
    acceptedTitle,
    "decision",
    "03",
    "accepted",
    [
      "```markdown\n## Why\nПример заголовка в коде.\n```",
      `%%\n## Why\n${hidden}: ${link(outsideWhy)}.\n%%`,
      "## Decision\nДля пилота использовать ежедневный CSV-импорт возвратов.",
      [
        "## Why",
        "У 9 из 40 тестовых возвратов не было стабильного идентификатора.",
        `Первичная сверка: ${link(measurement)} и ${link(denied)}. Черновые данные: ${link(unverified)}.`,
        `Требуется заполнить ${link(empty)}. %%${hidden}: ${link(outsideWhy)}.%%`,
        "",
        `[Пример ${link(outsideWhy)}](https://example.com/pilot) и [сноска ${link(outsideWhy)}][reference].`,
        "",
        `${link(outsideWhy)}[reference]`,
      ].join("\n"),
      `## Revisit\nДва последовательных прогона без несопоставленных ID.\n\n## Appendix\n${link(outsideWhy)}\n\n[reference]: https://example.com/pilot`,
    ].join("\n\n"),
    { date, projects: [link(mayak)] },
  );
  const lexicalBait = "Маяк API интеграция. Включить прямую API интеграцию.";
  const draft = writeNote("Маяк — включить API интеграцию", "decision", "05", "proposed", lexicalBait, {
    date: "2026-11-24",
    projects: [link(mayak)],
  });
  writeNote("Север — API интеграция", "decision", "06", "accepted", lexicalBait, { date, projects: [link(north)] });
  writeNote("Маяк — упоминание проекта", "decision", "07", "accepted", `${lexicalBait}\n${link(mayak)}`, { date });
  const competitorTitle = "Кассовые чеки — перенести сверку";
  const competitor = writeNote(
    competitorTitle,
    "decision",
    "04",
    "accepted",
    `## Decision\nСверять чеки по пятницам.\n\n## Why\nТак согласовано с бухгалтерией. ${link(outsideWhy).replace("]]", "|сверка чеков]]")}.\n\n## Revisit\nЧерез месяц.`,
    { date, projects: [link(mayak)] },
  );
  put(
    vault,
    competitor,
    readFileSync(path.join(vault, competitor), "utf8").replace(
      `# ${competitorTitle}`,
      `%%\n# Маяк API интеграция интеграцию\n%%\n\n# ${competitorTitle}`,
    ),
  );
  const primary = writeNote(
    measurement,
    "record",
    "08",
    "verified",
    "## Measurement\n31 из 40 возвратов сопоставили со стабильным ID, у 9 стабильного ID не было.",
    { date, subtype: "evidence" },
  );
  writeNote(outsideWhy, "record", "09", "verified", "Не относится к обоснованию.", { date, subtype: "evidence" });
  writeNote(denied, "record", "10", "verified", "Закрытое измерение.", {
    date,
    subtype: "evidence",
    agent_access: "denied",
  });
  writeNote(unverified, "record", "11", "recorded", "Непроверенное измерение.", { date, subtype: "evidence" });
  writeNote(empty, "record", "12", "verified", null, { date, subtype: "evidence" });

  if (
    !item.query ||
    !item.project_id ||
    item.expected_ids?.length !== 2 ||
    !item.expected_why ||
    !item.expected_revisit ||
    !item.expected_measurement
  )
    throw new Error(`${item.id}: incomplete Project Decision evidence golden`);
  const store = new BetterSqliteStore(path.join(directory, `${item.id}.sqlite`));
  try {
    const revision = store.rebuild({ vaultRoot: vault, vaultId: "synthetic-decision", vaultFingerprint: fingerprint });
    const access = { purpose: "agent_context", vaultFingerprint: fingerprint, expectedRevision: revision } as const;
    const rawMatches = new Set(store.searchTerms(item.query).map(({ path }) => path));
    requireCase(
      rawMatches.has(draft) && rawMatches.has(competitor),
      item.id,
      "competitive draft or same-Project accepted Decision missing from raw search",
    );
    requireCase(
      store.searchDecisionTerms(item.query, "or").every((hit) => hit.path !== competitor),
      item.id,
      "hidden terms made the same-Project competitor eligible for Decision search",
    );
    const result = retrieveProjectDecisionEvidence(store, item.project_id, item.query, access);
    const rawHash = (file: string) => {
      const raw = readFileSync(path.join(vault, file));
      return createHash("sha256").update(raw).digest("hex");
    };
    const decisionRef = {
      entityId: item.expected_ids[0],
      path: accepted,
      hash: rawHash(accepted),
    };
    const recordRef = {
      entityId: item.expected_ids[1],
      path: primary,
      hash: rawHash(primary),
    };
    const cites = (actual: PackItem["source"] | undefined, expected: typeof decisionRef) =>
      actual?.entityId === expected.entityId && actual?.path === expected.path && actual?.hash === expected.hash;
    requireCase(
      Boolean(
        result?.projectId === item.project_id &&
          result.vaultFingerprint === fingerprint &&
          result.indexRevision === revision &&
          !result.truncated &&
          result.decision.text.includes("ежедневный CSV-импорт") &&
          result.decision.trust === "untrusted_data" &&
          result.decision.source.heading === "Decision" &&
          cites(result.decision.source, decisionRef),
      ),
      item.id,
      "wrong accepted Project Decision or provenance",
    );
    requireCase(
      Boolean(
        result?.why?.text.startsWith(item.expected_why) &&
          !result.why.text.includes(hidden) &&
          result.why.trust === "untrusted_data" &&
          result.why.source.heading === "Why" &&
          cites(result.why.source, decisionRef),
      ),
      item.id,
      "Why excerpt or provenance mismatch",
    );
    requireCase(
      Boolean(
        result?.revisit &&
          result.revisit.text === item.expected_revisit &&
          result.revisit.trust === "untrusted_data" &&
          result.revisit.source.heading === "Revisit" &&
          cites(result.revisit.source, decisionRef),
      ),
      item.id,
      "Revisit excerpt or provenance mismatch",
    );
    requireCase(
      Boolean(
        result?.records.length === 1 &&
          result.records[0]?.text.includes(item.expected_measurement) &&
          result.records[0].trust === "untrusted_data" &&
          cites(result.records[0].source, recordRef),
      ),
      item.id,
      "primary verified Record missing, unexpected Record included, or provenance mismatch",
    );
    for (const [changed, expectedCode] of [
      [{ vaultFingerprint: "wrong" }, "RETRIEVAL-001"],
      [{ expectedRevision: "stale" }, "RETRIEVAL-002"],
    ] as const) {
      let rejected = false;
      try {
        retrieveProjectDecisionEvidence(store, item.project_id, item.query, { ...access, ...changed });
      } catch (error) {
        rejected = error instanceof Error && "code" in error && error.code === expectedCode;
      }
      requireCase(rejected, item.id, "wrong Vault or stale Decision evidence revision returned");
    }

    const hiddenRecords = ["%%\nЧерновая сверка.\n%%", "<!-- Черновая сверка. -->"].map((comment, i) => {
      const title = `Маяк — скрытая сверка ${i + 1}`;
      const file = writeNote(title, "record", String(13 + i), "verified", null, { date, subtype: "evidence" });
      put(vault, file, `${readFileSync(path.join(vault, file), "utf8")}${comment}\n`);
      return title;
    });
    const extraRecords = Array.from({ length: 6 }, (_, i) => `Маяк — повторная сверка ${i + 1}`);
    const fullBudget = [
      primary,
      ...extraRecords.map((title, i) =>
        writeNote(title, "record", String(15 + i), "verified", "## Measurement\n40 из 40.", {
          date,
          subtype: "evidence",
        }),
      ),
    ];
    const regressions = [
      {
        name: "comment must not assemble a wikilink resolved in Appendix",
        body: [
          "## Why",
          `[%% пояснение %%${link(outsideWhy).slice(1)}`,
          link(outsideWhy).replace(" ", "%% пояснение %%"),
          link(measurement),
        ].join("\n"),
        expected: [primary],
        escapedLink: `\\[\\[${link(outsideWhy).slice(2)}`,
      },
      {
        name: "a fence inside a comment must not swallow visible rationale evidence",
        body: [
          "%%",
          "```",
          hidden,
          "%%",
          "## Why",
          "Измерение ниже.",
          "",
          "```",
          "%%",
          "```",
          "",
          link(measurement),
        ].join("\n"),
        expected: [primary],
      },
      {
        name: "Records containing only comments must not displace visible evidence at the limit",
        body: `## Why\n${[...hiddenRecords, measurement, ...extraRecords].map(link).join("\n")}`,
        expected: fullBudget,
      },
    ];
    for (const { name, body, expected, escapedLink } of regressions) {
      writeNote(acceptedTitle, "decision", "03", "accepted", `${body}\n\n## Appendix\n${link(outsideWhy)}`, {
        date,
        projects: [link(mayak)],
      });
      const expectedRevision = store.rebuild({
        vaultRoot: vault,
        vaultId: "synthetic-decision",
        vaultFingerprint: fingerprint,
      });
      const evidence = retrieveProjectDecisionEvidence(store, item.project_id, item.query, {
        ...access,
        expectedRevision,
      });
      requireCase(
        Boolean(
          evidence?.why &&
            (escapedLink === undefined || evidence.why.text.includes(escapedLink)) &&
            !evidence.truncated &&
            evidence.records.length === expected.length &&
            evidence.records.every(
              ({ source }, i) => source.path === expected[i] && source.hash === rawHash(source.path),
            ),
        ),
        item.id,
        name,
      );
    }

    const encodedQuery = item.query.replace("интеграц", "&#1080;нтеграц");
    const rationale = `${encodedQuery} ${link(measurement)}`;
    writeNote(
      acceptedTitle,
      "decision",
      "03",
      "accepted",
      `## Decision\nСохраняем CSV.\n\n## Why\n${rationale}\n\n## Revisit\n${item.expected_revisit}`,
      { date, projects: [link(mayak)] },
    );
    put(
      vault,
      accepted,
      readFileSync(path.join(vault, accepted), "utf8").replace(`# ${acceptedTitle}`, "# Подключение CSV"),
    );
    const paymentTitle = item.query.endsWith("интеграцию") ? "Перенести интеграцию платежей" : "Интеграция платежей";
    writeNote(
      competitorTitle,
      "decision",
      "04",
      "accepted",
      `## Decision\nПеренести оплату картой.\n\n## Why\nСогласовано с бухгалтерией. ${link(outsideWhy)}.`,
      { date, projects: [link(mayak)] },
    );
    put(
      vault,
      competitor,
      readFileSync(path.join(vault, competitor), "utf8").replace(`# ${competitorTitle}`, `# ${paymentTitle}`),
    );
    const entityRevision = store.rebuild({
      vaultRoot: vault,
      vaultId: "synthetic-decision",
      vaultFingerprint: fingerprint,
    });
    requireCase(
      store.searchDecisionTerms(item.query, "or").some(({ path }) => path === competitor),
      item.id,
      "same-Project accepted competitor missing from partial Decision matches",
    );
    const entityEvidence = retrieveProjectDecisionEvidence(store, item.project_id, item.query, {
      ...access,
      expectedRevision: entityRevision,
    });
    requireCase(
      Boolean(
        entityEvidence?.why?.text === rationale &&
          cites(entityEvidence.decision.source, { ...decisionRef, hash: rawHash(accepted) }) &&
          entityEvidence.revisit?.text === item.expected_revisit &&
          entityEvidence.records.length === 1 &&
          cites(entityEvidence.records[0]?.source, recordRef),
      ),
      item.id,
      "an HTML entity next to a wikilink let the same-Project competitor win",
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
  const whyCompetition: { caseId: string; expectedRank: number; matchedDistractors: number }[] = [];
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
      const whyIds = cases
        .filter((item) => item.metric === "decision_why_recall@5")
        .flatMap((item) => item.expected_ids ?? []);
      if (whyIds.length !== new Set(whyIds).size)
        throw new Error("Decision why expected IDs must represent distinct decisions.");
      for (const item of cases) {
        if (!item.id || !item.metric) throw new Error("Golden case is missing id or metric.");
        const before = failures.length;
        const kind = item.kind ?? "search";
        if (kind === "search") {
          const allHits = local(item.query ?? "").hits;
          const hits = allHits.slice(0, 5);
          const ids = new Set(hits.map((hit) => hit.entityId));
          const found = (item.expected_ids ?? []).filter((id) => ids.has(id)).length;
          requireCase(found === item.expected_ids?.length, item.id, "expected search ID absent from top 5");
          searchFound += found;
          searchExpected += item.expected_ids?.length ?? 0;
          if (item.metric === "decision_why_recall@5") {
            whyFound += found;
            whyExpected += item.expected_ids?.length ?? 0;
            if (item.distractors) {
              const candidates = new Set(allHits.map((hit) => hit.entityId));
              const matchedDistractors = item.distractors.filter((candidate) => candidates.has(candidate.id)).length;
              requireCase(matchedDistractors === 5, item.id, "fewer than five competing distractors matched the query");
              whyCompetition.push({
                caseId: item.id,
                expectedRank: allHits.findIndex((hit) => hit.entityId === item.expected_ids?.[0]) + 1,
                matchedDistractors,
              });
            }
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
        } else if (kind === "project_decision_evidence") {
          runProjectDecisionCase(item, directory);
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
        } else if (kind === "unicode_normalization") {
          for (const query of [item.query ?? "", item.fallback_query ?? ""])
            requireCase(
              local(query).hits.some((hit) => hit.path === item.expected_path),
              item.id,
              `canonically equivalent query ${query} missed note`,
            );
        } else if (kind === "accent_lexical") {
          requireCase(
            local(item.query ?? "").hits[0]?.path === item.expected_first_path,
            item.id,
            "accent-folded title match did not beat authority body match",
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
      whyCompetition,
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
