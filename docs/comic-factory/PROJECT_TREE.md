# Project Tree and Package Boundaries

Target tree. It is not an instruction to create hundreds of empty packages. Introduce packages incrementally when a vertical slice needs them. Keep Toonflow conventions and avoid duplicating existing providers, tool scaffolding, mobile app or file abstractions.

```text
apps/
  web/                         # Existing Vue/Vite UI; add Comic Factory screens
  server/                      # Existing Bun/Express API; add comic routes/services
  mobile/                      # Existing Android host and APK packaging; retain
  desktop/                     # Existing desktop host

packages/
  comicFactory/                # First domain package: contracts and pure rules
    src/
      schemas/
      constitution/
      prompts/
      agents/
      world/
      production/
      index.ts
    tests/

  providers/                   # Existing provider registry and model contracts
  toolScaffold/                # Existing Tool extension contract
  tools/                       # Existing tools; add focused comic tools as needed
  nodes/                       # Existing Canvas nodes; add visual editors as needed
  skills/                      # Existing skill system; add task playbooks as needed

infrastructure/
  comic-factory/
    workflow-runtime/           # Durable workflow deployment; separate from mobile APK
    database/                   # Migrations and schema ownership
    object-storage/             # Asset storage and lifecycle
    observability/              # Logs, metrics, traces, alerts

docs/comic-factory/
  README.md
  PROJECT_TREE.md
  CONSTITUTION_AND_RULES.md
  PREPRODUCTION_AND_AGENT_RUNTIME.md
  WORLD_GRAPH_AND_ENTITY_ONBOARDING.md
  PROVIDERS_DIALOGUE_RENDERING.md
  ANDROID_BUILD_AND_RELEASE.md
  IMPLEMENTATION_ROADMAP.md
  REPOSITORY_AUDIT.md

tests/
  contracts/
  constitution/
  continuity/
  workflow/
  rendering/
  android/
  fault-injection/
```

## Dependency direction

- UI -> server API -> application services -> domain contracts.
- Domain packages must not import Vue, browser globals, Toonflow Canvas runtime or provider SDK internals.
- Provider adapters implement capability contracts; routing depends on declared capabilities, not vendor names.
- Agents call registered tools through validated contracts. Tools call domain services. Agents must not write database rows directly.
- Renderer consumes immutable, validated render manifests and produces deterministic files.
- Workflow activities call application services and are idempotent. Workflow state is durable; business state is persisted in the database.
- Android is a client/host. Do not package Temporal server, model credentials or heavy GPU workloads in the APK.

## Package conventions

Each package should expose a narrow public API from src/index.ts, use strict schemas at boundaries, keep implementation files private, include tests and document capability limitations. Do not add dependencies until the existing repository dependency graph has been audited. Do not create a package merely to mirror every class or agent role.
