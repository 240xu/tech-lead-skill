# R7 Admission Evidence — guidance aggregator gate

Date: 2026-08-26 · Scope: R7 Task 1 of docs/superpowers/plans/2026-08-26-dsh-themis-r7-implementation.md

## Observed workflows (internal, fixture-level)

| # | Workflow | Manual merge observed | Evidence anchor |
|---|---|---|---|
| W1 | progress PAUSE queue ∩ gate-aggregate closure actions over the same gate ids | yes — r6-guidance probes hand-align `blockingGateIds` with aggregate `MISSING_ROLE` actions | tests/r6-guidance.test.js (progress/gate blocks) |
| W2 | freshness refresh actions ∩ progress stale-evidence actions over the same evidence ids | yes — same-file freshness probes reuse ids/fingerprints by hand | tests/r6-guidance.test.js (freshness block) |
| W3 | starter loop handoffs (classify tier → context.tier; evidence array re-serialization into lint) | yes — documented as explicit caller duties in the fixture contract | tests/fixtures/starter-context.v1.json |

## Gate assessment

- R6 starter loop documented+tested: **met**.
- Strict action queue stable and traceable: **met** (deterministic actionId ordering pinned).
- "Three observed workflows show repeated manual merging": met only by **internal fixture construction**, not by external users. The plugin ships no telemetry by design, so external signal cannot be produced from this repository alone.

## Decision

`tech_lead_guidance` aggregation is **DEFERRED**. Discovery (metadata v2 + `tech_lead_capabilities`) shipped in its place because it carries no adoption precondition. Revisit the aggregator when at least one external consumer reports repeated manual merging, or on explicit user request.
