# Pre-production, Planning and Agent Runtime

## Production gate

No image/panel generation starts until Preflight approves a versioned Master Production Bible containing:
1. user brief and acceptance criteria;
2. genre, audience, language and tone;
3. world bible and world laws;
4. power/magic/economy/social systems as applicable;
5. character, relationship, item, outfit, creature, faction and location plans;
6. story arc, season outlines, chapter outlines and ending strategy;
7. style profile, typography and reading direction;
8. positive/negative prompt policies;
9. model/provider capability plan and fallback;
10. asset plan, estimated panel count, cost budget and concurrency limits;
11. continuity constraints and test plan.

AI creates this material automatically from the brief. User may edit/lock any section. Unspecified low-risk details may be inferred and marked as assumptions; material ambiguities or hard-rule conflicts require clarification.

## Planning hierarchy

Series -> Season -> Chapter -> Scene -> Sequence -> Panel -> Render task.

Each plan node has objective, narrative function, required entities/assets, dependencies, inputs, outputs, acceptance criteria, continuity preconditions, expected state changes and estimated cost. Maintain canonical plan, adaptive plan and production plan separately.

A creative improvement may update the plan only through a change proposal. Production errors must never mutate canon to make a failed output appear valid.

## Agent specification and instruction compiler

Every agent/model must be configured before delegation. A versioned AgentSpec contains:
- role, objective, responsibilities and prohibited actions;
- capability requirements and supported modalities;
- required context sources;
- inherited constitution/rule IDs;
- allowed tools and permission scopes;
- workflow instructions and retry boundaries;
- input/output JSON schemas;
- acceptance tests and independent validators;
- timeout, token/image budget and failure policy;
- model/provider selection constraints and fallback list.

Instruction Compiler produces task-specific instructions from AgentSpec plus task package. It must not expose credentials or unrelated project data.

## Delegation contract

TaskPackage contains task ID, parent goal, objective, scope, dependencies, immutable input references, context snapshot, constitution version, asset IDs/versions, positive/negative constraints, selected model capability profile, allowed tool IDs, expected output schema, acceptance criteria, timeout, retry budget and idempotency key.

Delegation sequence:
1. resolve task dependencies;
2. match worker/model against capability manifest;
3. compile and validate instructions;
4. validate context and permissions;
5. execute through durable worker;
6. validate schema and artifact existence;
7. run independent domain/visual QA;
8. commit output and state events only after acceptance;
9. otherwise classify error and repair/retry/fallback.

An agent cannot self-approve, skip validation, edit hard rules or write canon directly.

## Dynamic staffing

Use a small number of durable worker pools by capability: reasoning, text, image, vision, search, speech, subtitle and rendering. Agents are task roles implemented as configured workers, not necessarily separate always-running model instances. Scale workers based on queue depth, provider rate limits, GPU capacity and budget.

## Long-running execution

Persist workflow state, task attempts, heartbeats, checkpoints, artifacts and events. Use idempotent activities and an outbox/event pattern. Retry transient failures with bounded exponential backoff; do not retry permanent schema/policy failures blindly. Isolate failures by panel/chapter. Resume from validated artifacts after restart. Cancellation and budget exhaustion must leave a recoverable state.
