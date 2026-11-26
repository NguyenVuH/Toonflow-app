import type { ProductionBible } from "../schemas/planning";
import { productionBibleSchema } from "../schemas/planning";
import type { WorkflowGraph } from "../schemas/workflow";
import { validateWorkflowGraph } from "../workflow/graph";

export type PreflightResult = { passed: boolean; blockers: string[]; warnings: string[] };

export function validateProductionPreflight(
  bibleInput: ProductionBible,
  graphInput: WorkflowGraph,
  registeredProviderIds: string[],
  readyAssetIds: string[]
): PreflightResult {
  const bible = productionBibleSchema.parse(bibleInput);
  const graph = validateWorkflowGraph(graphInput);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!graph.valid) blockers.push(...graph.issues.map(issue => `Workflow: ${issue.message}`));
  if (bible.constitutionVersion < 1) blockers.push("A valid constitution version is required");
  if (!bible.styleProfileId.trim()) blockers.push("A style profile is required");
  if (!registeredProviderIds.length) blockers.push("At least one compatible AI provider must be configured");
  if (bible.budgetUsd <= 0) blockers.push("A positive production budget is required");
  if (bible.chapterPlans.some(plan => plan.status === "draft" || plan.status === "blocked")) blockers.push("All initial chapter plans must be ready before image production");
  const ready = new Set(readyAssetIds);
  const missingAssets = bible.assetPlanRefs.filter(id => !ready.has(id));
  if (missingAssets.length) blockers.push(`Required planned assets are not ready: ${missingAssets.join(", ")}`);
  if (!bible.preflightPassed) warnings.push("Production Bible has not yet been marked preflightPassed by its owner");
  return { passed: blockers.length === 0, blockers, warnings };
}
