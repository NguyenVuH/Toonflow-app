# Providers, Prompts, Dialogue, Rendering and Export

## Provider capability registry

Keep Toonflow's existing Provider system and add a normalized capability manifest. Required capability families: text/reasoning, image generation/editing, vision, search/research, speech/TTS, ASR, subtitle/translation, embeddings and rendering. Each adapter declares modalities, reference-image count/modes, image sizes/ratios, negative-prompt support, seed/steps/guidance/sampler support, async jobs, callbacks, cancellation, batch limits, rate limits and output formats.

Routing modes: manual, auto-by-capability, quality-first, cost-first and fallback. Never assume OpenAI compatibility means identical behavior. Provider-specific options remain provider-owned and are validated before execution. Secrets remain in server-side provider settings and never enter task manifests or logs.

## Prompt compilation

Every image task compiles positive prompt, negative prompt, style profile, entity references, current state, camera/composition, scene action and model parameters. Persist original instruction, compiled prompt, provider mapping, capability check, references, seed (when supported), model/provider versions and output hash.

Negative constraints are layered global -> series -> style/entity -> scene -> panel. Detect contradictions with positive constraints. Unsupported negative fields must be reported as unsupported and mitigated with explicit positive constraints plus independent QA, never silently dropped.

## Dialogue configuration

Dialogue is configurable per series and overridable at narrower scope:
- generation enabled/disabled;
- mode: script-driven, image-driven or hybrid;
- render mode: SVG/vector overlay, native text-in-image, or hybrid;
- narration, speech, thought, SFX and captions toggles;
- language, tone, maximum bubble length, speaker identification and reading order;
- OCR validation and overflow checks.

When generation is disabled, the system must not invent dialogue. User-supplied dialogue may still be preserved according to settings. Image-driven dialogue may infer wording from visual context but cannot invent canon events or contradict the approved script/world state.

Default rendering should be vector/SVG overlay for correct Vietnamese and predictable typography. Native text-in-image is an opt-in provider capability and must pass OCR and semantic validation. If it fails, repair lettering or regenerate according to policy.

## Rendering pipeline

Immutable panel image + dialogue records + bubble geometry + typography + page template -> panel composition -> page composition -> chapter composition -> cover/table of contents/metadata -> export validation.

Renderer is deterministic code. It must not ask an LLM to concatenate images or lay out text. Support PNG/JPEG/Webtoon segments, PDF, CBZ and EPUB 3 Fixed Layout. Validate dimensions, color mode/profile, embedded fonts where supported, reading order, filenames, metadata, archive integrity and successful reopen.

## Export reproducibility

Store a render manifest with chapter/series IDs, page/panel order, source asset hashes, dialogue IDs, font versions, layout template version, renderer version and export settings. Re-export should not regenerate source art unless explicitly requested.
