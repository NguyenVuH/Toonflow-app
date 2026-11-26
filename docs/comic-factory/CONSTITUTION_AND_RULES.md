# Unified Creative Constitution

## Purpose

A single, versioned rule framework governs the entire studio. Users write natural-language instructions; the system converts them into structured rules, resolves scope and precedence, detects conflicts, generates tests and distributes a consistent rule snapshot to affected agents and services.

## Rule lifecycle

Natural-language request -> intent extraction -> candidate rules -> scope resolution -> conflict analysis -> simulation/impact report -> activation -> dispatch -> enforcement -> audit/rollback.

Do not silently infer missing critical semantics. Ask a concise clarification when a rule cannot be made testable or when two hard rules conflict.

## Rule record

Every rule includes:
- stable ruleId and immutable version;
- domain and scope;
- severity: hard, soft, preference or conditional;
- human-readable statement and machine-checkable predicate when possible;
- target selectors and effective chapter/scene range;
- source instruction and provenance;
- enforcement strategy and validation adapters;
- violation action: block, repair, warn or require approval;
- status: draft, active, superseded or retired;
- generated test cases and audit history.

## Scope hierarchy

Global -> series -> season -> chapter -> scene -> panel.

Character, item, location, style and agent-specific rules are orthogonal selectors. Narrower scope may add constraints but cannot silently weaken a parent hard rule. Conflicting hard rules at equal precedence block activation until resolved. Explicit exceptions must be scoped records with reason and expiry, not hidden prompt text.

## Rule domains

Story structure, world laws, power systems, character identity/behavior, relationships, item ownership/state, location continuity, timeline, knowledge state, art direction, composition/camera, positive prompts, negative prompts, dialogue, lettering, agent behavior, production limits, safety, rendering and export.

## Enforcement model

- Compile hard rules into deterministic validators where feasible.
- Generate task-specific rule context packages from a single immutable constitution version.
- Every task records the constitution version and relevant rule IDs.
- Validate output independently from the agent that generated it.
- For subtle personality consistency, use independent model evaluation plus evidence and confidence; never represent probabilistic evaluation as a guarantee.
- A model/provider that cannot accept a required negative prompt, reference image or parameter must be marked incompatible or routed to a supported alternative.

## Natural-language change handling

Example: "From chapter 20 onward, make the palette darker, but keep all character designs and power rules unchanged."

Create a scoped style rule effective from chapter 20, preserve identity/power rules, simulate impact on planned chapters and agents, then activate a new constitution version. Published chapters remain immutable. Retroactive edits require a separate revision plan and explicit authorization.

## Versioning and concurrency

Constitution updates use optimistic concurrency with expectedVersion. Task packages pin a version. A running task may finish on its pinned version or be cancelled/replanned according to policy; it must not silently mix versions. Store source text, compiled diff, impact analysis and test results.

## Prompt and negative-prompt precedence

Global -> series -> style/entity -> scene -> panel. Merge and deduplicate; resolve contradictions before calling a model. Keep positive and negative constraints distinct. Map them to provider-specific fields only when supported. For providers without a negative-prompt field, use prompt-side constraints only as weaker mitigation and run post-generation validation; never call it equivalent enforcement.
