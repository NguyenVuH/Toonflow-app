import type { ConstitutionRule, ConstitutionSnapshot } from "../schemas/rule";
import { constitutionSnapshotSchema } from "../schemas/rule";

const scopeRank = { global: 0, series: 1, season: 2, chapter: 3, scene: 4, panel: 5 } as const;

export type RuleContext = {
  seriesId: string;
  seasonId?: string;
  chapterId?: string;
  chapterNumber?: number;
  sceneId?: string;
  panelId?: string;
};

export type RuleConflict = {
  ruleIds: string[];
  reason: string;
};

function applies(rule: ConstitutionRule, context: RuleContext): boolean {
  if (rule.status !== "active") return false;
  if (rule.effectiveFromChapter && (context.chapterNumber ?? 0) < rule.effectiveFromChapter) return false;
  if (rule.effectiveThroughChapter && (context.chapterNumber ?? Number.MAX_SAFE_INTEGER) > rule.effectiveThroughChapter) return false;
  switch (rule.scope) {
    case "global": return true;
    case "series": return rule.scopeId === context.seriesId;
    case "season": return rule.scopeId === context.seasonId;
    case "chapter": return rule.scopeId === context.chapterId;
    case "scene": return rule.scopeId === context.sceneId;
    case "panel": return rule.scopeId === context.panelId;
  }
}

export function resolveRules(snapshotInput: ConstitutionSnapshot, context: RuleContext): ConstitutionRule[] {
  const snapshot = constitutionSnapshotSchema.parse(snapshotInput);
  return snapshot.rules.filter(rule => applies(rule, context)).sort((a, b) =>
    scopeRank[a.scope] - scopeRank[b.scope] ||
    (a.severity === "hard" ? -1 : b.severity === "hard" ? 1 : 0) ||
    a.ruleId.localeCompare(b.ruleId)
  );
}

/**
 * Conservative conflict detector: detects explicit predicate contradictions on the same path.
 * Natural-language semantic conflicts require a model-assisted proposal stage and must not be
 * auto-resolved by this deterministic function.
 */
export function detectPredicateConflicts(rules: ConstitutionRule[]): RuleConflict[] {
  const conflicts: RuleConflict[] = [];
  const hard = rules.filter(r => r.status === "active" && r.severity === "hard" && r.predicate?.path);
  for (let i = 0; i < hard.length; i++) {
    for (let j = i + 1; j < hard.length; j++) {
      const a = hard[i], b = hard[j];
      if (a.predicate?.path !== b.predicate?.path) continue;
      const pa = a.predicate, pb = b.predicate;
      if (!pa || !pb) continue;
      const contradictory =
        (pa.kind === "equals" && pb.kind === "equals" && JSON.stringify(pa.value) !== JSON.stringify(pb.value)) ||
        (pa.kind === "equals" && pb.kind === "not_equals" && JSON.stringify(pa.value) === JSON.stringify(pb.value)) ||
        (pb.kind === "equals" && pa.kind === "not_equals" && JSON.stringify(pb.value) === JSON.stringify(pa.value));
      if (contradictory) conflicts.push({
        ruleIds: [a.ruleId, b.ruleId],
        reason: `Contradictory hard predicates for ${pa.path}`
      });
    }
  }
  return conflicts;
}

export function assertNoHardRuleConflicts(rules: ConstitutionRule[]): void {
  const conflicts = detectPredicateConflicts(rules);
  if (conflicts.length) {
    throw new Error(`Hard rule conflicts: ${conflicts.map(c => c.ruleIds.join(" <> ")).join(", ")}`);
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function buildRuleContextPackage(snapshot: ConstitutionSnapshot, context: RuleContext) {
  const rules = resolveRules(snapshot, context);
  assertNoHardRuleConflicts(rules);
  return deepFreeze({
    seriesId: snapshot.seriesId,
    constitutionVersion: snapshot.version,
    rules: rules.map(rule => ({ ...rule })),
    hardRules: rules.filter(rule => rule.severity === "hard"),
    softRules: rules.filter(rule => rule.severity !== "hard")
  });
}
