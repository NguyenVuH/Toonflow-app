import { z } from "zod";

export const agentCapabilitySchema = z.enum([
  "reasoning", "text", "image_generation", "image_editing", "vision",
  "search", "speech", "asr", "subtitle", "rendering"
]);

export const agentSpecSchema = z.object({
  agentId: z.string().min(1).max(128),
  version: z.number().int().positive(),
  role: z.string().min(1).max(256),
  objective: z.string().min(1).max(4000),
  responsibilities: z.array(z.string().min(1).max(1000)).min(1),
  prohibitedActions: z.array(z.string().min(1).max(1000)).default([]),
  requiredCapabilities: z.array(agentCapabilitySchema).min(1),
  requiredContext: z.array(z.string().min(1).max(256)).default([]),
  allowedToolIds: z.array(z.string().min(1).max(128)).default([]),
  deniedToolIds: z.array(z.string().min(1).max(128)).default([]),
  inputSchema: z.record(z.string(), z.json()),
  outputSchema: z.record(z.string(), z.json()),
  instructions: z.string().min(1).max(20000),
  acceptanceCriteria: z.array(z.string().min(1).max(1000)).min(1),
  timeoutSeconds: z.number().int().min(1).max(86400).default(900),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  maxCostUsd: z.number().nonnegative().optional(),
  active: z.boolean().default(true)
}).strict().superRefine((spec, ctx) => {
  const overlap = spec.allowedToolIds.filter(id => spec.deniedToolIds.includes(id));
  if (overlap.length) ctx.addIssue({ code: "custom", path: ["deniedToolIds"], message: `Tools cannot be both allowed and denied: ${overlap.join(", ")}` });
});

export const taskPackageSchema = z.object({
  taskId: z.string().min(1).max(128),
  idempotencyKey: z.string().min(8).max(256),
  parentGoalId: z.string().min(1).max(128),
  agentId: z.string().min(1).max(128),
  agentSpecVersion: z.number().int().positive(),
  objective: z.string().min(1).max(4000),
  scope: z.object({ seriesId: z.string().min(1), seasonId: z.string().optional(), chapterId: z.string().optional(), sceneId: z.string().optional(), panelId: z.string().optional() }).strict(),
  dependencies: z.array(z.string().min(1)).default([]),
  input: z.record(z.string(), z.json()),
  contextRefs: z.array(z.object({ kind: z.string().min(1), id: z.string().min(1), version: z.number().int().positive().optional() }).strict()),
  constitutionVersion: z.number().int().positive(),
  requiredRuleIds: z.array(z.string().min(1)),
  assetRefs: z.array(z.object({ assetId: z.string().min(1), version: z.number().int().positive(), role: z.string().min(1) }).strict()),
  allowedToolIds: z.array(z.string().min(1)),
  outputSchema: z.record(z.string(), z.json()),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  timeoutSeconds: z.number().int().min(1).max(86400),
  maxAttempts: z.number().int().min(1).max(10),
  createdAt: z.string().datetime()
}).strict();

export type AgentSpec = z.infer<typeof agentSpecSchema>;
export type TaskPackage = z.infer<typeof taskPackageSchema>;
