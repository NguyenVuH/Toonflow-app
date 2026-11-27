import { z } from "zod";

export const ruleSeveritySchema = z.enum(["hard", "soft", "preference", "conditional"]);
export const ruleScopeSchema = z.enum(["global", "series", "season", "chapter", "scene", "panel"]);
export const ruleStatusSchema = z.enum(["draft", "active", "superseded", "retired"]);
export const ruleDomainSchema = z.enum([
  "story", "world", "character", "relationship", "item", "location", "timeline",
  "knowledge", "art", "composition", "prompt", "negative_prompt", "dialogue",
  "agent", "production", "rendering", "export"
]);

export const constitutionRuleSchema = z.object({
  ruleId: z.string().min(1).max(128),
  version: z.number().int().positive(),
  domain: ruleDomainSchema,
  scope: ruleScopeSchema,
  scopeId: z.string().min(1).optional(),
  severity: ruleSeveritySchema,
  statement: z.string().min(1).max(4000),
  predicate: z.object({
    kind: z.enum(["equals", "not_equals", "in", "not_in", "requires", "forbids", "custom"]),
    path: z.string().min(1).max(512).optional(),
    value: z.unknown().optional(),
    expression: z.string().max(2000).optional()
  }).optional(),
  effectiveFromChapter: z.number().int().positive().optional(),
  effectiveThroughChapter: z.number().int().positive().optional(),
  violationAction: z.enum(["block", "repair", "warn", "approval"]).default("block"),
  status: ruleStatusSchema.default("draft"),
  sourceInstruction: z.string().max(8000).optional(),
  createdAt: z.string().datetime(),
  supersedes: z.string().optional()
}).strict().superRefine((rule, ctx) => {
  if (rule.scope !== "global" && !rule.scopeId) {
    ctx.addIssue({ code: "custom", path: ["scopeId"], message: "Non-global rules require scopeId" });
  }
  if (rule.effectiveThroughChapter && rule.effectiveFromChapter &&
      rule.effectiveThroughChapter < rule.effectiveFromChapter) {
    ctx.addIssue({ code: "custom", path: ["effectiveThroughChapter"], message: "Chapter range is reversed" });
  }
});

export type ConstitutionRule = z.infer<typeof constitutionRuleSchema>;

export const constitutionSnapshotSchema = z.object({
  seriesId: z.string().min(1),
  version: z.number().int().positive(),
  rules: z.array(constitutionRuleSchema),
  createdAt: z.string().datetime()
}).strict().superRefine((snapshot, ctx) => {
  const ids = new Set<string>();
  for (const rule of snapshot.rules) {
    const key = `${rule.ruleId}@${rule.version}`;
    if (ids.has(key)) ctx.addIssue({ code: "custom", message: `Duplicate rule version: ${key}` });
    ids.add(key);
  }
});

export type ConstitutionSnapshot = z.infer<typeof constitutionSnapshotSchema>;
