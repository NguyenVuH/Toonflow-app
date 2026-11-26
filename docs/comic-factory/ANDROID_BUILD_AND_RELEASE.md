# Android Build and Release

## Existing implementation

Toonflow already has apps/mobile, an Android ARM64 APK pipeline, a local Bun backend, shared web UI, system WebView with bundled GeckoView fallback, and device-interconnection mode. Reuse this application. Do not create a parallel Android app or replace its runtime without a measured need.

The mobile build documentation specifies Windows, Bun, JDK 17+, Android SDK Platform 37.1 and Build Tools 36.0.0. Run bun run --cwd apps/mobile setup, then bun run --cwd apps/mobile typecheck, then build with androidRelease=1 for R8/resource shrinking and non-debuggable output.

## Responsibility split

- Android: brief input, rule/style editor, project library, progress monitor, chapter reader, lightweight edits, notifications and downloads.
- Backend: orchestration, database, provider credentials, search, image generation, vision QA, dialogue, rendering and exports.
- Workers: long-running, parallelizable tasks. Do not run multi-hour production in Android foreground process.
- Storage: remote object storage for large image assets; local cache for offline reading and exports.

## Build process

Use repository's existing mobile setup/build scripts and Android packaging workflow. Do not modify signing keys or publish a release until build artifacts and install/launch tests pass. Debug and release APKs must be clearly distinguished. Never commit API keys, provider secrets or signing secrets.

## CI and artifact policy

CI should install the pinned Bun version, JDK and Android SDK; install dependencies; run package typechecks, unit/contract/integration tests; run mobile setup and build on Windows runner; upload APK as workflow artifact; install APK on emulator/device where available and smoke-test launch/navigation/backend health; attach to GitHub Release only after an explicitly approved release.

Existing debug workflow already contains Android setup/build steps. Prefer extending/reusing it over duplicating build logic. Its workflow_dispatch cannot be triggered from a GitHub read/write contents API alone; use Actions UI or an authorized workflow-dispatch capability.
