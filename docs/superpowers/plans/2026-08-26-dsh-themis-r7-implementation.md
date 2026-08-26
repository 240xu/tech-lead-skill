# DSH Themis R7 Discovery and Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. R7 must not start until R6 acceptance criteria are met.

**Goal:** Make the 21-tool Themis surface discoverable through registered capability metadata and, only if measured need remains, add a bounded guidance aggregator that merges already-normalized R6 actions.

**Architecture:** Metadata is generated from the actually registered tool set, not assumed from core exports. Recipes describe supported call sequences. `tech_lead_guidance` is optional and strictly merges R6 guidance; it never reimplements validators, persists state, invokes tools, or interprets raw legacy findings.

**Tech Stack:** Node.js ESM, `node:test`, existing DSH tool factory and artifact builder.

**Spec:** `docs/superpowers/specs/2026-08-26-dsh-themis-guidance-architecture.md` §§5, 9, 10.

## Global Constraints

- R6 must be released and its starter loop tested before R7 implementation.
- The plugin remains read-only and offline.
- `tech_lead_capabilities` returns only currently registered tools.
- `nextTools` references only currently registered tools; unavailable names are omitted.
- The aggregator accepts bounded R6 envelopes only; bare legacy results are rejected.
- The aggregator may sort, deduplicate, explain, and report conflicts, but cannot reproduce domain validation logic.
- Heuristic guidance remains explicit, labeled, non-authoritative, and separate from strict actions.

## File Map

- Modify: `packages/dsh-themis/src/core/capabilities.js` — metadata v2 and recipe descriptors.
- Modify: `packages/dsh-themis/src/tools.js` — register `tech_lead_capabilities` and pass registered names into metadata.
- Create: `packages/dsh-themis/src/core/guidance-aggregate.js` — bounded envelope merge and conflict detection.
- Create/modify: `packages/dsh-themis/src/tools/guidance.js` — aggregator adapter if admitted.
- Modify: `packages/dsh-themis/src/index.js` — expose only public package exports needed by tests; do not expose hidden execution.
- Create: `tests/r7-discovery.test.js`, `tests/fixtures/r7-results.json`.
- Modify: artifact smoke, READMEs, technical guide.

### Task 1: Record R7 admission evidence

- [ ] Run the R6 starter loop fixture at least three times with distinct valid snapshots.
- [ ] Record whether users still manually merge multiple tool outputs after capability metadata and recipes are available.
- [ ] If the discovery metadata solves the problem, stop R7 after Task 3 and do not implement the aggregator.
- [ ] Commit the evidence record separately: `docs(r7): record guidance aggregation admission evidence`.

### Task 2: Define capability metadata v2 and recipes

**Interfaces:** `getCapabilities({registeredNames?}) -> Capability[]`; each descriptor includes `recommendedWhen`, `requires`, `consumes`, `produces`, `nextTools`, `recipe`, `decisionMeaning`.

- [ ] Write failing tests for complete descriptors, stable ordering, no unavailable `nextTools`, and six recipe names.
- [ ] Implement descriptors as immutable data; do not infer behavior from free-form descriptions.
- [ ] Validate `nextTools` against the names passed from the current registration call.
- [ ] Run focused tests and commit: `feat(r7): add registered capability recipes`.

### Task 3: Register capability discovery

**Interfaces:** Registered tool `tech_lead_capabilities`; input is optional `recipe` and `domain` primitives; output is bounded JSON string of matching descriptors.

- [ ] Write tests proving an installed plugin can call discovery through `ctx.tools.register`, not merely import `getCapabilities`.
- [ ] Register the tool with no filesystem/network/process imports.
- [ ] Enforce output limits and return `BAD_INPUT` for unknown recipe filters.
- [ ] Run composition test and artifact test; verify tool count becomes 22 only if the product accepts the added discovery entry point.
- [ ] Update all claims that say exactly 21 tools to “21 governance tools plus discovery” or keep discovery outside the count explicitly.
- [ ] Commit: `feat(r7): expose read-only capability discovery`.

### Task 4: Specify aggregator wire contract

**Input:**

```json
{
  "contextJson": "{...}",
  "resultsJson": "[{\"tool\":\"tech_lead_progress_decide\",\"resultJson\":\"{...}\"}]",
  "optionsJson": "{\"guidanceMode\":\"strict\"}"
}
```

- [ ] Write tests for valid R6 envelope, duplicate action IDs, conflicting predicates, missing operation match, mismatched fingerprint, bare legacy result, and oversized results.
- [ ] Require `tool === result.meta.operation`, recognized result schema/version, and complete strict guidance.
- [ ] Define `GUIDANCE_CONFLICT` for same `actionId` with different `doneWhen`, target, or reason.
- [ ] Commit tests before implementation: `test(r7): define guidance aggregation wire contract`.

### Task 5: Implement merge-only aggregator if admitted

**Interfaces:** `aggregateGuidance(context, resultRecords, options) -> envelope`; it consumes normalized R6 `guidance.nextActions` and returns deduplicated actions, conflicts, and resume conditions.

- [ ] Implement bounded parsing using the R6 parser and a lower aggregate result budget.
- [ ] Sort only by the existing strict priority, then `actionId`; never invent priority from raw findings.
- [ ] Deduplicate identical action IDs only when all semantic fields match.
- [ ] Return `ok:false` for schema mismatch, incomplete input, conflict, or legacy result input.
- [ ] Add heuristic suggestions only from explicit heuristic inputs; never synthesize them from raw findings.
- [ ] Run focused tests and commit: `feat(r7): merge normalized guidance results`.

### Task 6: R7 artifact and adoption verification

- [ ] Run full source, composition, and artifact tests.
- [ ] Clean-install the tarball and call `tech_lead_capabilities` through a real loader.
- [ ] Verify no `nextTools` points to unregistered names.
- [ ] Verify the aggregator cannot accept legacy bare outputs or change strict verdicts.
- [ ] Measure first-valid-call time, calls-to-decision, invalid-input rate, and action reuse in fixture/manual trials.
- [ ] Publish only after the R7 release checklist and remote tarball inspection pass.
