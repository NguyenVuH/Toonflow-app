# World Graph and Dynamic Entity Onboarding

## Canonical entities

Character, item, outfit, location, creature, faction, ability, vehicle, organization, event and relationship each have stable IDs. Names and aliases may change; IDs do not. Entity records include version, lifecycle state, source, first appearance, last appearance and asset references.

## Relationships and state

Represent relationships as typed, temporal edges (OWNS, EQUIPPED, LOCATED_AT, MEMBER_OF, ALLIED_WITH, KNOWS, TRANSFERRED_TO, DESTROYED_BY). Every state change is an event with actor, target, chapter/scene time, cause, evidence and resulting state. Keep event history and chapter snapshots; never rely on vector search as source of truth.

## New entity pipeline

1. Detect candidate entities in chapter/scene plans and scripts.
2. Resolve aliases and duplicates using exact IDs, names, descriptions, relationships and visual similarity.
3. Check canon, timeline and rule conflicts.
4. Generate a complete design brief and entity specification.
5. Generate canonical references appropriate to type:
   - character: face, full-body, turnarounds, expressions, outfits, age/state variants;
   - item: orthographic views, scale, materials, details, damage variants;
   - location: establishing views, layout/landmarks, lighting/time/weather variants;
   - creature/vehicle/faction: silhouette, scale, marks, variants and relation references.
6. Validate identity, distinguishability, rule compliance and required views.
7. Register entity and immutable asset versions; connect graph edges and appearance events.
8. Mark READY only when required references and validation pass; otherwise block dependent panels and repair onboarding.

## Asset/model tiers

- Reference-only: reusable reference images and structured design specs.
- Identity representation: embeddings/feature descriptors or provider-specific reference bundles.
- Dedicated adaptation: LoRA or other fine-tuning only when justified by recurring importance, provider support, rights and cost.

Do not claim every new entity needs a trained model. Select the least expensive method that meets the measured consistency target. Store provenance and model licenses for all generated/trained assets.

## Continuity

Each panel receives a compiled context containing only relevant entities, exact asset versions, current state, location/time, ownership/equipment, character knowledge, prior scene facts and negative constraints. Changes are committed as events after accepted production, not inferred from pixels alone.
