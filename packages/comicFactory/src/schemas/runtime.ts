import { z } from "zod";

export const goalStatusSchema = z.enum(["draft", "planning", "preflight", "running", "blocked", "completed", "failed", "cancelled"]);
export const taskStatusSchema = z.enum(["pending", "ready", "leased", "running", "validating", "succeeded", "retry_wait", "failed", "cancelled"]);
export const taskFailureKindSchema = z.enum(["transient", "permanent", "policy", "invalid_output", "provider_capability", "budget"]);

export const goalSchema = z.object({
  goalId: z.string().min(1),
  seriesId: z.string().min(1),
  objective: z.string().min(1).max(12000),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  status: goalStatusSchema,
  planVersion: z.number().int().positive().default(1),
  constitutionVersion: z.number().int().positive(),
  budgetUsd: z.number().nonnegative(),
  spentUsd: z.number().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const taskRecordSchema = z.object({
  taskId: z.string().min(1),
  goalId: z.string().min(1),
  nodeId: z.string().min(1),
  dependencies: z.array(z.string().min(1)).default([]),
  status: taskStatusSchema,
  attempts: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().min(1).max(20).default(3),
  leaseOwner: z.string().optional(),
  leaseExpiresAt: z.string().datetime().optional(),
  nextAttemptAt: z.string().datetime().optional(),
  estimatedCostUsd: z.number().nonnegative().default(0),
  actualCostUsd: z.number().nonnegative().default(0),
  idempotencyKey: z.string().min(8),
  lastError: z.string().max(4000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export type GoalRecord = z.infer<typeof goalSchema>;
export type TaskRecord = z.infer<typeof taskRecordSchema>;
