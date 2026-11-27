import { z } from "zod";

export const entityTypeSchema = z.enum(["character", "item", "outfit", "location", "creature", "faction", "ability", "vehicle", "organization", "event"]);
export const entityLifecycleSchema = z.enum(["discovered", "designing", "reference_generating", "validating", "ready", "blocked", "retired"]);

export const entityAssetRefSchema = z.object({
  assetId: z.string().min(1),
  version: z.number().int().positive(),
  role: z.string().min(1),
  providerId: z.string().optional(),
  modelId: z.string().optional()
}).strict();

export const worldEntitySchema = z.object({
  entityId: z.string().min(1).max(128),
  version: z.number().int().positive(),
  type: entityTypeSchema,
  canonicalName: z.string().min(1).max(300),
  aliases: z.array(z.string().min(1).max(300)).default([]),
  description: z.string().min(1).max(12000),
  lifecycle: entityLifecycleSchema,
  firstAppearance: z.object({ chapterId: z.string().min(1), sceneId: z.string().optional() }).strict().optional(),
  assetRefs: z.array(entityAssetRefSchema).default([]),
  requiredReferenceRoles: z.array(z.string().min(1)).default([]),
  canonFacts: z.record(z.string(), z.json()).default({}),
  createdAt: z.string().datetime()
}).strict().superRefine((entity, ctx) => {
  if (entity.lifecycle === "ready") {
    const roles = new Set(entity.assetRefs.map(asset => asset.role));
    const missing = entity.requiredReferenceRoles.filter(role => !roles.has(role));
    if (missing.length) ctx.addIssue({ code: "custom", path: ["assetRefs"], message: `Ready entity is missing required references: ${missing.join(", ")}` });
  }
});

export const worldEventSchema = z.object({
  eventId: z.string().min(1),
  seriesId: z.string().min(1),
  chapterId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  eventType: z.string().min(1).max(128),
  actorEntityIds: z.array(z.string().min(1)),
  targetEntityIds: z.array(z.string().min(1)),
  occurredAtStoryTime: z.string().optional(),
  cause: z.string().min(1),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  stateDelta: z.record(z.string(), z.json()),
  createdAt: z.string().datetime()
}).strict();

export type WorldEntity = z.infer<typeof worldEntitySchema>;
export type WorldEvent = z.infer<typeof worldEventSchema>;
