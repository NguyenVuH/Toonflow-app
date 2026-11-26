import { z } from "zod";
import type { ConstitutionRule } from "../schemas/rule";
import { constitutionRuleSchema } from "../schemas/rule";
import { detectPredicateConflicts } from "./index";

const proposalSchema = z.object({
  summary: z.string().min(1).max(2000),
  assumptions: z.array(z.string().min(1)).default([]),
  questions: z.array(z.string().min(1)).default([]),
  rules: z.array(constitutionRuleSchema).min(1)
}).strict();

export type RuleProposal = z.infer<typeof proposalSchema>;
export type NaturalLanguageRuleAdapter = (input: {
  instruction: string; language: string; currentRules: ConstitutionRule[];
  target: { seriesId: string; scope: ConstitutionRule["scope"]; scopeId?: string };
}) => Promise<unknown>;

/** LLM adapter converts natural-language instructions (including Vietnamese) to draft rules only. */
export async function compileNaturalLanguageRules(input: {
  instruction: string; language?: string; currentRules: ConstitutionRule[];
  target: { seriesId: string; scope: ConstitutionRule["scope"]; scopeId?: string };
  compile: NaturalLanguageRuleAdapter;
}): Promise<RuleProposal> {
  if (!input.instruction.trim()) throw new Error("Rule instruction cannot be empty");
  const parsed = proposalSchema.parse(await input.compile({
    instruction: input.instruction, language: input.language ?? "vi",
    currentRules: input.currentRules, target: input.target
  }));
  const drafts = parsed.rules.map(rule => constitutionRuleSchema.parse({
    ...rule, status: "draft", sourceInstruction: input.instruction
  }));
  const proposedActive = drafts.map(rule => ({ ...rule, status: "active" as const }));
  const conflicts = detectPredicateConflicts([...input.currentRules, ...proposedActive]);
  if (conflicts.length) throw new Error(`Proposed rules conflict with active hard rules: ${conflicts.map(c => c.ruleIds.join(" <> ")).join("; ")}`);
  return { ...parsed, rules: drafts };
}
