import { z } from "zod";

export const planLevelSchema = z.enum(["series", "season", "chapter", "scene", "sequence", "panel", "render"]);
export const planStatusSchema = z.enum(["draft", "blocked", "ready", "running", "qa", "completed", "failed", "cancelled"]);

export const planNodeSchema = z.object({
  planId: z.string().min(1).max(128),
  parentPlanId: z.string().max(128).optional(),
  level: planLevelSchema,
  title: z.string().min(1).max(300),
  objective: z.string().min(1).max(4000),
  narrativeFunction: z.string().max(2000).optional(),
  status: planStatusSchema,
  dependencies: z.array(z.string().min(1)).default([]),
  requiredEntityIds: z.array(z.string().min(1)).default([]),
  requiredAssetIds: z.array(z.string().min(1)).default([]),
  preconditions: z.array(z.string().min(1)).default([]),
  expectedStateChanges: z.array(z.string().min(1)).default([]),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  estimatedCostUsd: z.number().nonnegative().optional(),
  constitutionVersion: z.number().int().positive(),
  revision: z.number().int().positive().default(1)
}).strict();

export const productionBibleSchema = z.object({
  seriesId: z.string().min(1),
  version: z.number().int().positive(),
  brief: z.string().min(1).max(12000),
  language: z.string().min(2).max(35),
  genre: z.array(z.string().min(1)).min(1),
  audience: z.string().min(1),
  worldBibleRef: z.string().min(1),
  constitutionVersion: z.number().int().positive(),
  styleProfileId: z.string().min(1),
  seasonPlans: z.array(planNodeSchema).min(1),
  chapterPlans: z.array(planNodeSchema).min(1),
  assetPlanRefs: z.array(z.string().min(1)),
  budgetUsd: z.number().nonnegative(),
  concurrencyLimit: z.number().int().min(1).max(1000),
  preflightPassed: z.boolean(),
  createdAt: z.string().datetime()
}).strict().superRefine((bible, ctx) => {
  if (bible.seasonPlans.some(p => p.level !== "season")) ctx.addIssue({ code: "custom", path: ["seasonPlans"], message: "seasonPlans may contain only season nodes" });
  if (bible.chapterPlans.some(p => p.level !== "chapter")) ctx.addIssue({ code: "custom", path: ["chapterPlans"], message: "chapterPlans may contain only chapter nodes" });
  if (bible.seasonPlans.some(p => p.status === "draft" || p.status === "blocked") && bible.preflightPassed) {
    ctx.addIssue({ code: "custom", path: ["preflightPassed"], message: "Preflight cannot pass while a season plan is draft or blocked" });
  }
});

export type PlanNode = z.infer<typeof planNodeSchema>;
export type ProductionBible = z.infer<typeof productionBibleSchema>;
