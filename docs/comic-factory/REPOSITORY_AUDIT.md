# Repository Audit — NguyenVuH/Toonflow-app

Audit baseline: repository branch master, commit eecf51547af47eb504822186bd3f2dee369125ff observed during initial review. Re-audit before each implementation phase because upstream may change.

## Confirmed from source

- Root package uses Bun 1.4.3 and workspaces apps/*, packages/*, plus additional package groups.
- Frontend: Vue 3, Vite, TypeScript, Pinia, Element Plus and Vue Flow.
- Server: Bun, Express 5 and Zod.
- Agent runtime: Pi Agent SDK with plugin tools and skills.
- Provider contracts live in packages/providers/types.d.ts; media model types currently cover text, image, video and audio.
- Tool plugin contracts live in packages/toolScaffold; tools are built as .tool.js bundles and receive validated workspace-scoped context.
- Mobile source is apps/mobile; it reuses the web UI and backend, runs Bun in the Android package and supports ARM64 only.
- Mobile setup/build commands and SDK requirements are documented in apps/mobile/readme.md.
- Existing .github/workflows/debug.yml has an Android ARM64 path that runs mobile setup and build on Windows.
- Root license file identifies MIT; preserve notices and audit dependencies/model licenses separately.

## Integration implications

- Reuse existing provider registry instead of creating a parallel vendor settings system.
- Reuse Tool scaffold for narrowly scoped comic tools; do not bypass its workspace file protections.
- Use existing mobile app rather than adding a second Android shell.
- Current Agent runtime is a per-session runtime and should not be treated as durable long-running production orchestration.
- Long-running production needs a separate durable workflow/worker service and persistent state.
- Existing mobile device interconnection is designed for trusted devices; do not expose unauthenticated standalone server ports publicly.

## Not yet verified

- Complete database/storage model and migration conventions.
- Exact route registration conventions for new Comic Factory APIs.
- Whether Temporal TypeScript SDK and workflow bundling work in this Bun monorepo; likely keep Temporal workers in a separate Node service if validated.
- Full CI execution, Android SDK availability and APK build result.
- Runtime behavior of any new Comic Factory module.

## Current work status

The branch has been created. This audit document is descriptive only. It does not claim the repository has been cloned to a local workstation, code has been built, or an APK has been produced.
