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


## Orientation and background execution requirements

The existing Android activity was configured with `sensorLandscape`. The Comic Factory branch changes this to `fullSensor` so portrait and landscape orientations are permitted. All mobile screens must use responsive layouts and preserve editor state across configuration changes.

Background production is not equivalent to keeping the Activity alive. The existing `mobileActivity` currently owns the Bun child process and stops it during Activity destruction. Therefore background execution is NOT yet implemented by the orientation change.

Before claiming background production, refactor process ownership into a dedicated Android foreground service with:
- a persistent, user-visible notification and notification channel;
- appropriate foreground-service type and permissions for the actual workload;
- a bound/local IPC contract for Activity status and commands;
- service-owned Bun process lifecycle, health checks and controlled restart;
- durable job state persisted by the backend so process death can resume safely;
- notification permission handling on Android 13+;
- battery-optimization guidance and clear user stop controls;
- no promise of surviving force-stop, reboot or vendor task-killer without explicit recovery behavior.

Prefer server-side durable workers for generation jobs whenever a reachable backend is configured. Android foreground service should primarily keep the on-device Toonflow host alive when local execution is explicitly selected. Do not run GPU/model workloads on the phone by default.

Vietnamese workflow support:
- use UTF-8 end-to-end for prompts, story bible, agent instructions, tool payloads, dialogue, filenames where supported, logs and exports;
- choose fonts with complete Vietnamese glyph coverage and embed/subset fonts in PDF where licensing permits;
- normalize input consistently (NFC) without destroying user-authored text;
- test diacritics, combining marks, punctuation, line wrapping, bubble overflow, OCR and search;
- keep provider/model tokenization limitations visible and never silently strip diacritics.

Required mobile acceptance tests:
- cold launch in portrait and landscape;
- rotate during story editing, file upload, reader and production monitoring without losing state;
- background the app while a foreground service is running and verify job status continues;
- return from background and reconcile server state;
- deny notification permission and verify the app explains degraded background visibility;
- force-stop and relaunch to verify durable jobs resume from server state rather than relying on the Android process;
- Vietnamese text round-trip through storage, agent task payloads, dialogue overlay, PDF and EPUB.


## Changes currently present on feature/comic-factory

- Android manifest uses `fullSensor` so both portrait and landscape orientations are allowed.
- A native `comicProductionService` foreground service has been added with a low-importance persistent notification and `dataSync` service type.
- The Activity starts the service and requests notification permission on Android 13+.
- The service improves process importance while the app is backgrounded. It does not yet own or supervise the Bun child process.
- The Activity still starts and owns the Bun child process and stops it when the Activity is destroyed. Therefore this is an initial background-liveness improvement, NOT full durable background execution or process-death recovery.
- Full background reliability still requires moving Bun lifecycle ownership into a service, durable backend job persistence, restart/reconciliation, and device tests. Do not advertise guaranteed continuation after process kill, force-stop, reboot or OEM task killer.

## Vietnamese workflow

The dialogue settings schema defaults to Vietnamese (`vi`). UI, database, prompt, tool payload, logs, fonts and export must remain UTF-8. The current schema is configuration support only; full Vietnamese end-to-end round-trip and visual typography tests are still pending.
