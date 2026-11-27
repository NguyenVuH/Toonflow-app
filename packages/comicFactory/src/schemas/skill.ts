import { z } from "zod";

export const skillSpecSchema = z.object({
  skillId: z.string().min(1).max(128),
  version: z.number().int().positive(),
  name: z.string().min(1).max(200),
  purpose: z.string().min(1).max(2000),
  domains: z.array(z.string().min(1)).min(1),
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  requiredContext: z.array(z.string().min(1)).default([]),
  instruction: z.string().min(1).max(24000),
  procedure: z.array(z.object({ stepId: z.string().min(1), instruction: z.string().min(1), required: z.boolean().default(true) }).strict()).min(1),
  toolIds: z.array(z.string().min(1)).default([]),
  inputSchema: z.record(z.string(), z.json()),
  outputSchema: z.record(z.string(), z.json()),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  failurePolicy: z.enum(["retry", "repair", "escalate", "block"]),
  language: z.string().default("vi"),
  active: z.boolean().default(true)
}).strict();

export type SkillSpec = z.infer<typeof skillSpecSchema>;
