import type { ProductionBible } from "../schemas/planning";
import { productionBibleSchema } from "../schemas/planning";
import type { WorkflowGraph } from "../schemas/workflow";
import { validateWorkflowGraph } from "../workflow/graph";

export type PreflightResult = { passed: boolean; blockers: string[]; warnings: string[] };

export function validateProductionPreflight(
  bibleInput: ProductionBible,
  graphInput: WorkflowGraph,
  registeredProviderIds: string[],
  readyAssetIds: string[],
  registeredToolIds: string[] = [],
  availableCapabilities: string[] = []
): PreflightResult {
  const bible = productionBibleSchema.parse(bibleInput);
  const graph = validateWorkflowGraph(graphInput);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!graph.valid) blockers.push(...graph.issues.map(issue => "Workflow: " + issue.message));
  if (bible.constitutionVersion < 1) blockers.push("A valid constitution version is required");
  if (!bible.styleProfileId.trim()) blockers.push("A style profile is required");
  if (!registeredProviderIds.length) blockers.push("At least one compatible AI provider must be configured");
  if (bible.budgetUsd <= 0) blockers.push("A positive production budget is required");
  if (bible.chapterPlans.some(plan => plan.status === "draft" || plan.status === "blocked")) blockers.push("All initial chapter plans must be ready before image production");
  const ready = new Set(readyAssetIds);
  const requiredAssetIds = [...new Set([...bible.seasonPlans, ...bible.chapterPlans].flatMap(plan => plan.requiredAssetIds))];
  const missingAssets = requiredAssetIds.filter(id => !ready.has(id));
  if (missingAssets.length) blockers.push("Required planned assets are not ready: " + missingAssets.join(", "));
  const tools = new Set(registeredToolIds);
  const missingTools = [...new Set(graphInput.nodes.flatMap(node => node.requiredToolIds ?? []))].filter(id => !tools.has(id));
  if (missingTools.length) blockers.push("Required workflow tools are not registered: " + missingTools.join(", "));
  const capabilities = new Set(availableCapabilities);
  const missingCapabilities = [...new Set(graphInput.nodes.flatMap(node => node.requiredCapabilities ?? []))].filter(id => !capabilities.has(id));
  if (missingCapabilities.length) blockers.push("Required worker capabilities are unavailable: " + missingCapabilities.join(", "));
  if (!bible.preflightPassed) warnings.push("Production Bible has not yet been approved by preflight");
  return { passed: blockers.length === 0, blockers, warnings };
}

/** Approval is a code-owned transition; model output cannot self-approve a series. */
export function approveProductionPreflight(
  bibleInput: ProductionBible,
  graphInput: WorkflowGraph,
  registeredProviderIds: string[],
  readyAssetIds: string[],
  registeredToolIds: string[] = [],
  availableCapabilities: string[] = []
): ProductionBible {
  const bible = productionBibleSchema.parse(bibleInput);
  const result = validateProductionPreflight(bible, graphInput, registeredProviderIds, readyAssetIds, registeredToolIds, availableCapabilities);
  if (!result.passed) throw new Error("Production preflight blocked: " + result.blockers.join("; "));
  return productionBibleSchema.parse({ ...bible, preflightPassed: true });
}
