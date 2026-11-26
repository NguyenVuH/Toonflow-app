# Toonflow Comic Factory

Status: engineering baseline / in-progress. This directory describes the proposed comic-production subsystem layered onto Toonflow. It does not claim every module is implemented.

## Product objective

Turn one natural-language brief into a planned, rule-governed, multi-chapter comic series. The system behaves like a production studio: pre-production, asset creation, delegated work, batch production, quality control, rendering, publishing and resumable operations.

## Non-negotiable principles

1. One source of truth: canon, rules, entity identity, timeline and asset versions live in structured project state, not isolated agent memories.
2. Plan before production: no panel generation until the series bible, world laws, season/chapter outlines, initial asset bible, style profile, production budget and preflight checks exist.
3. Natural-language configuration: users describe rules in ordinary language. The system compiles them into versioned, typed, testable rule records.
4. Deterministic enforcement: hard constraints are validated by code wherever possible. An agent cannot mark its own task successful.
5. Explicit delegation: every agent/model receives a detailed, versioned task package with objective, scope, context, rules, allowed tools, schemas, acceptance tests and failure policy.
6. Dynamic entity onboarding: new characters, items, outfits, creatures, locations and factions are detected, deduplicated, designed, referenced, validated and registered before use.
7. Provider-neutral: model selection is capability-based. Text, image, vision, search, speech and subtitle providers are configurable independently.
8. Reproducible assets: preserve compiled prompts, negative prompts, references, model/provider versions, parameters, seeds when supported, outputs and QA.
9. Durable execution: workflows survive restart, timeout, provider outage and partial failure; completed work is not regenerated unnecessarily.
10. Android-first control surface: reuse Toonflow's existing mobile application and build pipeline. Heavy generation and rendering belong on backend workers, not the phone.

## Existing Toonflow integration facts

- Repository is a Bun workspaces monorepo using TypeScript, Vue 3, Vite and an Express 5 server.
- Existing extension points include Tools, Nodes, Skills and Providers.
- packages/providers/types.d.ts describes text/image/video/audio model types and media request capabilities.
- packages/toolScaffold defines the tool plugin contract and workspace-scoped file operations.
- apps/mobile packages the Toonflow web UI and backend into an ARM64 Android APK, with system WebView and bundled GeckoView fallback.
- Mobile build is Windows-based and requires Android SDK Platform 37.1, Build Tools 36.0.0, JDK 17+, and the apps/mobile setup step.
- Mobile README warns that local device interconnection uses HTTP on trusted LAN unless HTTPS is configured; do not expose an unauthenticated standalone server port publicly.

## Target boundaries

- Toonflow remains the UI, plugin, provider and mobile host.
- Comic Factory packages own domain logic: constitution, world graph, pre-production, agent contracts, production, rendering and publishing.
- A durable workflow runtime owns long-running jobs. Temporal is a candidate, but must be validated against Bun/mobile packaging and deployed as a separate service/worker if required.
- Agents are reasoning workers, not the source of truth or workflow engine.
- Rendering is deterministic code, not an LLM responsibility.

## Delivery status

Branch begins with documentation and a typed domain-contract foundation. Implementation must be added in small vertical slices with tests. Do not claim 100% correctness: quality is established through explicit acceptance tests, regression suites and observed build artifacts.
