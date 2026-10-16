import addFormats from "ajv-formats";
import { z } from "zod";

const wikiLink = z.string().regex(/^\[\[.+\]\]$/);
const date = z.iso.date();
const validateDateTime = (addFormats.default.get("date-time", "full") as { validate: (value: string) => boolean })
  .validate;
const rfc3339DateTime = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;
const dateTime = z.string().regex(rfc3339DateTime).refine(validateDateTime).meta({ format: "date-time" });
const uniqueStrings = z
  .array(z.string())
  .refine((items) => new Set(items).size === items.length)
  .meta({ uniqueItems: true });
const uniqueLinks = z
  .array(wikiLink)
  .refine((items) => new Set(items).size === items.length)
  .meta({ uniqueItems: true });

export const managedEntityBase = z
  .object({
    ideomy_schema: z.literal(1),
    id: z.string().regex(/^(area|prj|gol|kn|src|per|org|dec|mtg|evt|rec|ast|plc|jrn|sys)_[0-9A-HJKMNP-TV-Z]{26}$/),
    type: z.enum([
      "area",
      "project",
      "goal",
      "knowledge",
      "source",
      "person",
      "organization",
      "decision",
      "meeting",
      "event",
      "record",
      "asset",
      "place",
      "journal",
      "system",
    ]),
    subtype: z.string().nullable().optional(),
    status: z.string(),
    aliases: uniqueStrings.optional(),
    primary_area: wikiLink.nullable().optional(),
    related_areas: uniqueLinks.max(2).optional(),
    topics: z
      .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      .max(10)
      .refine((items) => new Set(items).size === items.length)
      .meta({ uniqueItems: true })
      .optional(),
    projects: uniqueLinks.optional(),
    goals: uniqueLinks.optional(),
    people: uniqueLinks.optional(),
    organizations: uniqueLinks.optional(),
    places: uniqueLinks.optional(),
    sources: uniqueLinks.optional(),
    decisions: uniqueLinks.optional(),
    created: dateTime,
    updated: dateTime,
    sensitivity: z.enum(["public", "internal", "private", "sensitive"]),
    agent_access: z.enum(["allowed", "restricted", "local_only", "denied"]),
    tags: uniqueStrings.optional(),
    slug: z.string().optional(),
  })
  .catchall(z.unknown());

export const typePrefixes: Record<z.infer<typeof managedEntityBase>["type"], string> = {
  area: "area",
  project: "prj",
  goal: "gol",
  knowledge: "kn",
  source: "src",
  person: "per",
  organization: "org",
  decision: "dec",
  meeting: "mtg",
  event: "evt",
  record: "rec",
  asset: "ast",
  place: "plc",
  journal: "jrn",
  system: "sys",
};

const entity = (
  type: z.infer<typeof managedEntityBase>["type"],
  statuses: [string, ...string[]],
  properties: z.ZodRawShape = {},
) =>
  managedEntityBase.extend({
    id: z.string().regex(new RegExp(`^${typePrefixes[type]}_[0-9A-HJKMNP-TV-Z]{26}$`)),
    type: z.literal(type),
    status: z.enum(statuses),
    ...properties,
  });

export const entitySchemas = {
  area: entity("area", ["active", "inactive", "archived"], {
    domain: z.string(),
    review_cadence: z.enum(["weekly", "monthly", "quarterly", "yearly", "ad-hoc"]),
    health: z.enum(["healthy", "attention", "critical", "inactive"]).optional(),
    trend: z.enum(["improving", "stable", "declining", "unknown"]).optional(),
  }),
  project: entity("project", ["idea", "planned", "active", "waiting", "paused", "completed", "cancelled"], {
    primary_area: wikiLink.nullable(),
    outcome: z.string().min(1),
    definition_of_done: z.array(z.string()).optional(),
    started: date.nullable().optional(),
    target_date: date.nullable().optional(),
    completed: date.nullable().optional(),
  }),
  goal: entity("goal", ["draft", "active", "paused", "achieved", "abandoned"], {
    primary_area: wikiLink.nullable(),
    horizon: z.enum(["quarter", "1y", "3y", "long-term"]),
    target_date: date.nullable().optional(),
    success_criteria: z.array(z.string()).optional(),
  }),
  knowledge: entity("knowledge", ["seed", "developing", "evergreen", "deprecated", "superseded"], {
    primary_area: wikiLink.nullable(),
    subtype: z.enum([
      "concept",
      "principle",
      "pattern",
      "framework",
      "heuristic",
      "method",
      "playbook",
      "insight",
      "model",
      "comparison",
      "reference",
    ]),
  }),
  source: entity("source", ["inbox", "queued", "consuming", "processed", "archived"], {
    subtype: z.enum([
      "article",
      "book",
      "paper",
      "documentation",
      "website",
      "video",
      "podcast",
      "course",
      "conversation",
      "chat",
      "pdf",
      "report",
      "newsletter",
      "other",
    ]),
    author: z.array(z.string()).optional(),
    url: z.string().nullable().optional(),
    published: date.nullable().optional(),
    accessed: date.nullable().optional(),
    knowledge_created: z.array(wikiLink).optional(),
    attachment: wikiLink.nullable().optional(),
  }),
  person: entity("person", ["active", "dormant", "archived"], {
    relationship_types: uniqueStrings.optional(),
    last_interaction: date.nullable().optional(),
    next_follow_up: date.nullable().optional(),
  }),
  organization: entity("organization", ["active", "inactive", "archived"], {
    subtype: z.enum([
      "company",
      "employer",
      "client",
      "vendor",
      "service",
      "community",
      "institution",
      "government",
      "education",
      "nonprofit",
      "other",
    ]),
    url: z.string().nullable().optional(),
  }),
  decision: entity("decision", ["proposed", "accepted", "implemented", "rejected", "superseded"], {
    date,
    primary_area: wikiLink.nullable(),
    supersedes: wikiLink.nullable().optional(),
    superseded_by: wikiLink.nullable().optional(),
    review_date: date.nullable().optional(),
  }),
  meeting: entity("meeting", ["scheduled", "completed", "processed", "cancelled"], {
    subtype: z
      .enum([
        "work",
        "1on1",
        "interview",
        "research-interview",
        "client-call",
        "review",
        "mentoring",
        "networking",
        "personal",
        "other",
      ])
      .optional(),
    date,
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
  }),
  event: entity("event", ["planned", "completed", "cancelled"], {
    date,
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
  }),
  record: entity("record", ["recorded", "verified", "superseded", "invalid"], {
    subtype: z.enum([
      "evidence",
      "health",
      "financial",
      "measurement",
      "purchase",
      "maintenance",
      "administrative",
      "other",
    ]),
    date,
  }),
  asset: entity("asset", ["planned", "active", "maintenance", "sold", "retired", "lost"], {
    subtype: z.enum(["device", "vehicle", "property", "equipment", "digital", "license", "other"]),
    primary_area: wikiLink.nullable(),
    acquired: date.nullable().optional(),
    purchase_price: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
    warranty_until: date.nullable().optional(),
  }),
  place: entity("place", ["active", "inactive", "archived"], {
    subtype: z.enum([
      "country",
      "region",
      "city",
      "neighborhood",
      "venue",
      "hotel",
      "restaurant",
      "office",
      "airport",
      "other",
    ]),
    country: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
  }),
  journal: entity("journal", ["open", "reviewed", "closed"], {
    subtype: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
    date: date.nullable().optional(),
    period_start: date.nullable().optional(),
    period_end: date.nullable().optional(),
  }),
  system: entity("system", ["draft", "active", "deprecated"], {
    subtype: z.enum([
      "specification",
      "schema",
      "workflow",
      "prompt",
      "agent-policy",
      "template",
      "dashboard",
      "taxonomy",
      "migration",
      "moc",
      "other",
    ]),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/),
    change_type: z.string().nullable().optional(),
  }),
} as const;

export type ManagedEntityType = keyof typeof entitySchemas;
