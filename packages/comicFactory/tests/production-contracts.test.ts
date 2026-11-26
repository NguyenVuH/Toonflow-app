import { describe, expect, test } from "bun:test";
import { compileAgentInstruction } from "../src/agents/instructions";
import { compileImagePrompt } from "../src/prompts/compiler";
import { dialogueSettingsSchema, worldEntitySchema } from "../src/schemas";

describe("dialogue configuration", () => {
  test("supports disabling generated dialogue and Vietnamese", () => {
    const settings = dialogueSettingsSchema.parse({ generationEnabled: false, language: "vi" });
    expect(settings.generationEnabled).toBe(false);
    expect(settings.language).toBe("vi");
  });
});

describe("world entity onboarding", () => {
  test("does not allow an entity to become ready without required references", () => {
    const result = worldEntitySchema.safeParse({
      entityId: "CHAR_001", version: 1, type: "character", canonicalName: "Kai",
      description: "Main character", lifecycle: "ready", requiredReferenceRoles: ["face", "turnaround"],
      assetRefs: [], createdAt: "2026-11-26T00:00:00.000Z"
    });
    expect(result.success).toBe(false);
  });
});

describe("provider-aware prompt compiler", () => {
  const capability = {
    providerId: "test-provider", modelId: "image-model", modalities: ["image" as const],
    supportsNegativePrompt: true, supportsImageReferences: true, maxImageReferences: 4,
    supportsImageEditing: true, supportsSeed: true, supportsAsyncJobs: true,
    supportsCancellation: true, supportedRatios: [], supportedOutputFormats: ["png"]
  };

  test("rejects positive/negative contradictions", () => {
    expect(() => compileImagePrompt({
      seriesId: "S1", taskId: "T1", positivePrompt: "blue eyes",
      negativePrompt: ["blue eyes"], styleProfileId: "STYLE1", entityRefs: [],
      width: 1024, height: 1024, parameters: {}
    }, capability)).toThrow("Positive/negative prompt conflict");
  });

  test("routes reference requirements only to capable models", () => {
    expect(() => compileImagePrompt({
      seriesId: "S1", taskId: "T1", positivePrompt: "fantasy character",
      negativePrompt: [], styleProfileId: "STYLE1",
      entityRefs: [{ entityId: "CHAR1", version: 1, role: "identity" }],
      width: 1024, height: 1024, parameters: {}
    }, { ...capability, supportsImageReferences: false, maxImageReferences: 0 })).toThrow("cannot accept required entity reference");
  });
});

describe("agent instruction compiler", () => {
  test("rejects tools outside the agent permission scope", () => {
    const spec = {
      agentId: "storyboard", version: 1, role: "Storyboard Director", objective: "Plan panels",
      responsibilities: ["Create storyboard"], prohibitedActions: ["Change canon"],
      requiredCapabilities: ["reasoning" as const], requiredContext: ["bible"],
      allowedToolIds: ["read_bible"], deniedToolIds: [], inputSchema: { type: "object" },
      outputSchema: { type: "object" }, instructions: "Follow the storyboard contract.",
      acceptanceCriteria: ["All panels have scene references"], timeoutSeconds: 900, maxAttempts: 2, active: true
    };
    const task = {
      taskId: "TASK1", idempotencyKey: "TASK1-idempotent", parentGoalId: "GOAL1",
      agentId: "storyboard", agentSpecVersion: 1, objective: "Plan chapter 1",
      scope: { seriesId: "SERIES1", chapterId: "CH1" }, dependencies: [],
      input: { chapterId: "CH1" }, contextRefs: [], constitutionVersion: 1,
      requiredRuleIds: [], assetRefs: [], allowedToolIds: ["delete_series"],
      outputSchema: { type: "object" }, acceptanceCriteria: ["Valid storyboard"],
      timeoutSeconds: 900, maxAttempts: 2, createdAt: "2026-11-26T00:00:00.000Z"
    };
    expect(() => compileAgentInstruction(spec, task)).toThrow("outside the AgentSpec permission scope");
  });
});
