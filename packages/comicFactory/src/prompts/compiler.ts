import type { ImagePromptRequest, ProviderCapability } from "../schemas/media";
import { imagePromptRequestSchema, providerCapabilitySchema } from "../schemas/media";

export type CompiledImageRequest = {
  providerId: string;
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  parameters: Record<string, unknown>;
  referenceEntityIds: string[];
  warnings: string[];
};

function normalizeTerm(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

/** Compile provider-aware prompt fields. This does not pretend unsupported negative prompts were applied. */
export function compileImagePrompt(
  requestInput: ImagePromptRequest,
  capabilityInput: ProviderCapability,
  providerParameters: Record<string, unknown> = {}
): CompiledImageRequest {
  const request = imagePromptRequestSchema.parse(requestInput);
  const capability = providerCapabilitySchema.parse(capabilityInput);
  if (capability.modelId.length === 0) throw new Error("Provider capability has no modelId");
  const positive = normalizeTerm(request.positivePrompt);
  const negatives = [...new Set(request.negativePrompt.map(normalizeTerm).filter(Boolean))];
  const conflicts = negatives.filter(term => positive.includes(term));
  if (conflicts.length) throw new Error(`Positive/negative prompt conflict: ${conflicts.join(", ")}`);
  const warnings: string[] = [];
  const parameters: Record<string, unknown> = { ...providerParameters, ...request.parameters, width: request.width, height: request.height };
  if (request.seed !== undefined) {
    if (capability.supportsSeed) parameters.seed = request.seed;
    else warnings.push("Selected model does not support seed; requested seed was not applied.");
  }
  if (request.entityRefs.length && !capability.supportsImageReferences) {
    throw new Error("Selected model cannot accept required entity reference images");
  }
  if (request.entityRefs.length > capability.maxImageReferences) {
    throw new Error(`Selected model accepts at most ${capability.maxImageReferences} references; task requires ${request.entityRefs.length}`);
  }
  if (negatives.length && !capability.supportsNegativePrompt) {
    warnings.push("Selected model has no native negative-prompt capability; route to a compatible model or accept weaker prompt-side mitigation with post-generation QA.");
  }
  if (capability.supportedRatios.length) {
    const ratio = (request.width / request.height).toFixed(3);
    const supported = capability.supportedRatios.some(value => value === ratio || value === `${request.width}:${request.height}`);
    if (!supported) warnings.push(`Requested aspect ratio ${ratio} is not listed as natively supported.`);
  }
  return {
    providerId: capability.providerId,
    modelId: capability.modelId,
    prompt: request.positivePrompt,
    ...(negatives.length && capability.supportsNegativePrompt ? { negativePrompt: negatives.join(", ") } : {}),
    parameters,
    referenceEntityIds: request.entityRefs.map(ref => ref.entityId),
    warnings
  };
}
