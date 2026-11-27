import type { ProductionBible, PlanNode } from "../schemas/planning";
import { productionBibleSchema } from "../schemas/planning";

export type SeriesPlanAdapter = (input: {
  brief: string; language: string; userInstructions: string[];
  constraints: { requireWorldBible: true; requireSeasonOutlines: true; requireChapterOutlines: true; requireAssetPlan: true; noPanelGenerationDuringPreproduction: true };
}) => Promise<unknown>;
export type PlanValidation = { valid: boolean; errors: string[]; topologicalOrder: string[] };

function validatePlanDag(nodes: PlanNode[]): PlanValidation {
  const errors: string[] = [];
  const byId = new Map<string, PlanNode>();
  for (const node of nodes) {
    if (byId.has(node.planId)) errors.push("Duplicate plan ID: " + node.planId);
    byId.set(node.planId, node);
  }
  const indegree = new Map(nodes.map(node => [node.planId, 0]));
  const outgoing = new Map(nodes.map(node => [node.planId, [] as string[]]));
  for (const node of nodes) {
    for (const dependency of node.dependencies) {
      if (!byId.has(dependency)) { errors.push("Missing dependency " + dependency + " referenced by " + node.planId); continue; }
      outgoing.get(dependency)!.push(node.planId);
      indegree.set(node.planId, indegree.get(node.planId)! + 1);
    }
    if (node.parentPlanId && !byId.has(node.parentPlanId)) errors.push("Missing parent " + node.parentPlanId + " for " + node.planId);
  }
  const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id).sort();
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!; order.push(id);
    for (const child of outgoing.get(id)!) {
      indegree.set(child, indegree.get(child)! - 1);
      if (indegree.get(child) === 0) { queue.push(child); queue.sort(); }
    }
  }
  if (order.length !== nodes.length) errors.push("Production plan contains a dependency cycle");
  return { valid: errors.length === 0, errors, topologicalOrder: order };
}

/** Validates the creative plan. External provider and asset readiness are a separate preflight gate. */
export function validateMasterProductionPlan(input: ProductionBible): PlanValidation {
  const bible = productionBibleSchema.parse(input);
  const dag = validatePlanDag([...bible.seasonPlans, ...bible.chapterPlans]);
  const errors = [...dag.errors];
  if (bible.seasonPlans.some(node => !["ready", "completed"].includes(node.status))) errors.push("Every season outline must be ready before production");
  if (bible.chapterPlans.some(node => !["ready", "completed"].includes(node.status))) errors.push("Every initial chapter outline must be ready before production");
  if (!bible.assetPlanRefs.length) errors.push("An initial asset plan is required");
  return { valid: errors.length === 0, errors, topologicalOrder: dag.topologicalOrder };
}

/** AI-generated plans are always returned unapproved; only the deterministic preflight gate may approve them. */
export async function createMasterProductionPlan(input: {
  brief: string; language?: string; userInstructions?: string[]; compile: SeriesPlanAdapter;
}): Promise<ProductionBible> {
  if (!input.brief.trim()) throw new Error("A story brief is required");
  const raw = await input.compile({
    brief: input.brief, language: input.language ?? "vi", userInstructions: input.userInstructions ?? [],
    constraints: { requireWorldBible: true, requireSeasonOutlines: true, requireChapterOutlines: true, requireAssetPlan: true, noPanelGenerationDuringPreproduction: true }
  });
  const parsed = productionBibleSchema.parse(raw);
  const bible = productionBibleSchema.parse({ ...parsed, preflightPassed: false });
  const validation = validateMasterProductionPlan(bible);
  if (!validation.valid) throw new Error("Pre-production blocked: " + validation.errors.join("; "));
  return bible;
}
