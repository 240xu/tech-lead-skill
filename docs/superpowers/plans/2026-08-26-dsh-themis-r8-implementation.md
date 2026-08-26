# DSH Themis R8 Context and Contract Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. R8 must not start until R6 is stable and R7 evidence justifies migration.

**Goal:** Introduce a versioned canonical Context v2 and an explicit result-protocol negotiation path without silently breaking released state or legacy tool consumers.

**Architecture:** R8 begins with one-way `state.json v1 -> tech-lead.context.v2` projection. It does not promise reverse conversion until lossless equivalence is proven. Every conversion reports warnings and loss. Legacy tools preserve their documented bare default for one minor-release compatibility window while opting into ResultEnvelope v2 through `protocolJson`.

**Tech Stack:** Node.js ESM, `node:test`, JSON fixtures, existing artifact/composition tests.

**Spec:** `docs/superpowers/specs/2026-08-26-dsh-themis-guidance-architecture.md` §§6, 7, 8 and post-approval amendments §§14.7-14.8.

## Global Constraints

- R8 is not a prerequisite for R6 safety fixes or R7 discovery.
- No automatic writes to `state.json`; projection is a pure function.
- Identity and fingerprint values cannot be invented during conversion.
- Strict mode rejects unknown fields outside namespaced `extensions`.
- Compat mode preserves opaque extensions but core decisions ignore them.
- Original nine tools default to legacy output for one declared minor-release window.
- Unsupported protocol/schema requests return structured `UNSUPPORTED_SCHEMA_VERSION` or `BAD_INPUT`.

## File Map

- Create: `packages/dsh-themis/src/core/context-v2.js` — schema v2 validation, normalization, one-way projection.
- Create: `packages/dsh-themis/src/core/protocol-v2.js` — protocol negotiation and legacy projection wrapper.
- Modify: `packages/dsh-themis/src/core/context.js` — v1 compatibility parsing only where specified.
- Modify: `packages/dsh-themis/src/protocol.js` — protocolJson parsing, complete metadata, bounded conversion input.
- Modify: `packages/dsh-themis/src/tools.js` and all adapters — common protocol option wiring.
- Create: `tests/fixtures/state-v1-representative-*.json`, `tests/fixtures/context-v2-*.json`.
- Create: `tests/r8-migration.test.js`; modify artifact smoke and composition tests.
- Modify: README/spec/technical guide/changelog with compatibility window and migration examples.

### Task 1: Gather R8 admission evidence and field inventory

- [ ] Inventory all v1 state fields from `skill/templates/state.json` and `core/state.js`.
- [ ] Create at least five representative state fixtures covering normal, degraded, active gate, completed work, and unknown extension fields.
- [ ] Record which fields have direct v2 homes and which require `state.*` or `extensions`.
- [ ] Do not implement reverse conversion if any fixture loses required semantics.
- [ ] Commit fixture inventory: `test(r8): establish state projection fixtures`.

### Task 2: Implement exact Context v2 validation

**Shape:** `{schema:"tech-lead.context",version:2,project,current,snapshot,state,goalLedger,nonGoals,constraints,decisions,risks,dependencies,evidence,assumptions,extensions}`.

- [ ] Write failing tests for required identity/fingerprint, explicit version, `current` fields, complete state projection, strict unknown-field rejection, compat extension preservation, and invalid namespaced extension keys.
- [ ] Implement `validateContextV2(raw, {mode:"strict"|"compat"})` with structured paths and `UNSUPPORTED_SCHEMA_VERSION` distinction.
- [ ] Ensure `tech-lead.context.v1` normalizes internally to version 1 only; do not pretend it is already v2.
- [ ] Run focused tests and commit: `feat(r8): validate canonical context v2`.

### Task 3: Implement one-way state projection

**Interface:** `projectStateToContextV2(state, {projectId,projectName,snapshotSource,snapshotFingerprint,at}) -> {ok,value,warnings,losses}`.

- [ ] Write tests for total mapping of every known state v1 field: mode, tier, phase, repository mode, persistence, done, gates, goal ledger, constraints, decisions, risks, dependencies, evidence, critical path, protected assets, hypotheses, assumptions, last outcome, next review trigger, degraded reason, tags, next step, updated_at.
- [ ] Require projection options for project identity, snapshot source, fingerprint, and timestamp; missing required options returns `NON_CONVERTIBLE_STATE`.
- [ ] Map snake_case fields exactly to the v2 locations and preserve empty arrays/strings without inventing values.
- [ ] Put only explicitly classified opaque fields under `extensions`; report all loss.
- [ ] Run fixtures through `validateContextV2`; commit: `feat(r8): project state v1 into context v2`.

### Task 4: Add protocol negotiation without breaking defaults

**Interface:** `parseProtocolOptions(protocolJson) -> {inputCompatibility,outputProtocol}`.

- [ ] Write tests for omitted options, strict/compat, legacy/v2 output, invalid JSON, unsupported selections, and legacy default preservation.
- [ ] Add optional `protocolJson` to every public adapter.
- [ ] Keep original nine tools defaulting to legacy for the declared release window; strengthened tools default to v2.
- [ ] Return `UNSUPPORTED_SCHEMA_VERSION` for unavailable output protocol rather than silently changing shape.
- [ ] Commit: `feat(r8): negotiate result protocol explicitly`.

### Task 5: Implement ResultEnvelope v2 and legacy projections

- [ ] Write tests that every v2 result includes `ok`, `code`, `data`, `findings`, `warnings`, `guidance`, `meta.schema`, `meta.outputProtocol`, `meta.complete`, and deterministic metadata.
- [ ] Ensure legacy projection preserves exact bare array/object shape by default and never claims completeness when the source scan was truncated.
- [ ] Make `PAUSE`, `PIVOT`, and gate conditional/reject valid `ok:true` data outcomes in v2.
- [ ] Add `legacyProjection` only as an explicit output option; do not let it discard safety errors.
- [ ] Run source and artifact tests; commit: `feat(r8): add versioned result envelope migration`.

### Task 6: Prove or defer reverse projection

- [ ] Attempt `contextV2ToProjectState` only in a scratch implementation or test design, not public API, using all representative fixtures.
- [ ] If any field or identity/fingerprint cannot be reconstructed exactly, record `NON_LOSSLESS_PROJECTION` and defer reverse conversion.
- [ ] Do not add a bidirectional API merely because field names can be mechanically renamed.
- [ ] Commit the decision record: `docs(r8): record context projection loss boundary`.

### Task 7: R8 compatibility and release verification

- [ ] Run full tests, composition, artifact smoke, and clean-install protocol negotiation.
- [ ] Test released v1 fixture inputs against the new compat parser.
- [ ] Verify no default legacy consumer receives an envelope unexpectedly during the compatibility window.
- [ ] Verify all unknown fields outside `extensions` are rejected in strict mode and opaque extensions are ignored by decisions.
- [ ] Update migration docs with exact examples and removal version for legacy defaults.
- [ ] Publish only after tarball, README, schema, compatibility, and rollback review passes.
