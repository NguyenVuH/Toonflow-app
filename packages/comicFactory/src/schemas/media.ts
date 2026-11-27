import { z } from "zod";

export const dialogueSettingsSchema = z.object({
  generationEnabled: z.boolean().default(true),
  generationMode: z.enum(["script", "image", "hybrid"]).default("hybrid"),
  renderMode: z.enum(["overlay", "native", "hybrid"]).default("overlay"),
  narrationEnabled: z.boolean().default(true),
  speechEnabled: z.boolean().default(true),
  thoughtEnabled: z.boolean().default(true),
  sfxEnabled: z.boolean().default(true),
  captionsEnabled: z.boolean().default(false),
  language: z.string().min(2).max(35).default("vi"),
  tone: z.string().max(500).default("natural"),
  maxBubbleCharacters: z.number().int().min(10).max(1000).default(180),
  readingDirection: z.enum(["ltr", "rtl", "vertical"]).default("ltr"),
  ocrValidationEnabled: z.boolean().default(true)
}).strict();

export const providerCapabilitySchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  modalities: z.array(z.enum(["text", "image", "vision", "search", "speech", "asr", "subtitle", "embedding"])).min(1),
  supportsNegativePrompt: z.boolean().default(false),
  supportsImageReferences: z.boolean().default(false),
  maxImageReferences: z.number().int().nonnegative().default(0),
  supportsImageEditing: z.boolean().default(false),
  supportsSeed: z.boolean().default(false),
  supportsAsyncJobs: z.boolean().default(false),
  supportsCancellation: z.boolean().default(false),
  supportedRatios: z.array(z.string()).default([]),
  supportedOutputFormats: z.array(z.string()).default([])
}).strict().superRefine((capability, ctx) => {
  if (!capability.supportsImageReferences && capability.maxImageReferences > 0) {
    ctx.addIssue({ code: "custom", path: ["maxImageReferences"], message: "Reference count must be zero when image references are unsupported" });
  }
});

export const imagePromptRequestSchema = z.object({
  seriesId: z.string().min(1),
  taskId: z.string().min(1),
  positivePrompt: z.string().min(1).max(12000),
  negativePrompt: z.array(z.string().min(1).max(500)).default([]),
  styleProfileId: z.string().min(1),
  entityRefs: z.array(z.object({ entityId: z.string().min(1), version: z.number().int().positive(), role: z.string().min(1) }).strict()),
  width: z.number().int().min(256).max(8192),
  height: z.number().int().min(256).max(8192),
  seed: z.number().int().nonnegative().optional(),
  parameters: z.record(z.string(), z.json()).default({})
}).strict();

export type DialogueSettings = z.infer<typeof dialogueSettingsSchema>;
export type ProviderCapability = z.infer<typeof providerCapabilitySchema>;
export type ImagePromptRequest = z.infer<typeof imagePromptRequestSchema>;
