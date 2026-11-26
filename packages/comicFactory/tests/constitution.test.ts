import { describe, expect, test } from "bun:test";
import { assertNoHardRuleConflicts, buildRuleContextPackage, resolveRules } from "../src/constitution";
import type { ConstitutionSnapshot } from "../src/schemas";

const now = "2026-11-26T00:00:00.000Z";
const snapshot: ConstitutionSnapshot = {
  seriesId: "series-1",
  version: 3,
  createdAt: now,
  rules: [
    { ruleId: "global-1", version: 1, domain: "art", scope: "global", severity: "hard", statement: "No watermark", status: "active", violationAction: "block", createdAt: now },
    { ruleId: "series-1", version: 1, domain: "character", scope: "series", scopeId: "series-1", severity: "hard", statement: "Kai has blue eyes", predicate: { kind: "equals", path: "character.Kai.eyeColor", value: "blue" }, status: "active", violationAction: "block", createdAt: now },
    { ruleId: "chapter-20", version: 1, domain: "art", scope: "chapter", scopeId: "chapter-20", severity: "soft", statement: "Use a darker palette from chapter 20", effectiveFromChapter: 20, status: "active", violationAction: "warn", createdAt: now }
  ]
};

describe("constitution rule resolution", () => {
  test("inherits global and series rules and respects chapter range", () => {
    const rules = resolveRules(snapshot, { seriesId: "series-1", chapterId: "chapter-20", chapterNumber: 20 });
    expect(rules.map(r => r.ruleId)).toEqual(["global-1", "series-1", "chapter-20"]);
  });

  test("does not apply a chapter rule before its effective chapter", () => {
    const rules = resolveRules(snapshot, { seriesId: "series-1", chapterId: "chapter-19", chapterNumber: 19 });
    expect(rules.some(r => r.ruleId === "chapter-20")).toBe(false);
  });

  test("builds immutable task rule context", () => {
    const result = buildRuleContextPackage(snapshot, { seriesId: "series-1" });
    expect(result.constitutionVersion).toBe(3);
    expect(result.hardRules).toHaveLength(2);
    expect(Object.isFrozen(result)).toBe(true);
  });

  test("blocks contradictory active hard predicates", () => {
    const conflicting = [
      snapshot.rules[1],
      { ...snapshot.rules[1], ruleId: "conflict", predicate: { kind: "equals" as const, path: "character.Kai.eyeColor", value: "red" } }
    ];
    expect(() => assertNoHardRuleConflicts(conflicting)).toThrow("Hard rule conflicts");
  });
});
