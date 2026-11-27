# Implementation Roadmap and Acceptance Gates

## Phase 0 — repository audit
Map actual workspaces, routes, database, agent runtime, provider types, plugin contracts, mobile screens/build scripts, CI, storage and test conventions. Record exact source paths and reuse/extension decisions. No architecture assumptions may be treated as verified without source evidence.

## Phase 1 — contracts and constitution
Implement typed rule/dialogue/provider/task schemas, natural-language rule compilation interface, hierarchy, conflict detection, versioning, simulation contract, test generation and immutable task context. Add unit and contract tests.

## Phase 2 — durable autonomous runtime
Implement goal/task persistence, dependency graph, queue, worker leases, retries, cancellation, idempotency, checkpoints, event/outbox and supervisor. Evaluate Temporal as a separate service; do not bundle Temporal server in Toonflow or Android.

## Phase 3 — pre-production and world graph
Implement Master Production Bible, series/season/chapter/scene/sequence/panel plans, entity registry, event sourcing, snapshots, relationships, entity discovery and asset onboarding.

## Phase 4 — provider and agent delegation
Implement capability manifests, model routing, task package compiler, AgentSpec registry, permission scopes, provider fallback and provider health. Integrate with existing Toonflow provider and tool scaffolds.

## Phase 5 — comic production
Implement storyboard, prompt compiler, positive/negative constraints, image generation/editing, dialogue modes, lettering, visual QA, continuity QA and repair loops.

## Phase 6 — rendering and publishing
Implement deterministic panel/page/chapter rendering, export manifests, PDF/CBZ/EPUB/Webtoon output and format validators.

## Phase 7 — Android UX
Add mobile-first screens to existing apps/mobile-hosted web UI: series library, creation brief, pre-production review, rule/style editor, asset registry, provider settings, production monitor, reader and export center.

## Phase 8 — scale and resilience
Run multi-chapter production, concurrency and rate-limit tests, provider outage tests, worker restart tests, partial artifact recovery, data migration tests, Android install/launch tests and end-to-end series continuity tests.

## Acceptance gates

- No panel starts before pre-production preflight passes.
- A natural-language rule change produces a versioned diff, scope, impact report and tests.
- Hard rule conflict blocks activation.
- Every agent task has a valid AgentSpec and TaskPackage.
- Agent cannot self-approve or directly mutate canon.
- New entity is not used until canonical references are validated and registered.
- Dialogue OFF prevents generated dialogue; user-supplied dialogue behavior remains explicit.
- Unsupported provider capabilities are detected before execution.
- Positive/negative prompt conflicts are caught.
- Renderer produces reproducible outputs and validates archives/documents.
- Workflow resumes after restart without duplicating committed artifacts.
- Provider failure is isolated and fallback respects capabilities and budget.
- Android APK installs and launches; mobile client can observe server-side production progress.
- Long-run test demonstrates multi-chapter continuity and fault recovery.

## Quality statement

No system can honestly promise 100% correctness for creative model outputs. The engineering target is explicit constraints, measurable acceptance thresholds, independent validators, recoverable failures, regression tests and transparent reporting of residual uncertainty.
