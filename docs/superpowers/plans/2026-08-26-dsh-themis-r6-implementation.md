# DSH Themis R6 Safe Guidance Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add fail-closed resource and safety boundaries plus deterministic strict/explicit heuristic guidance to the existing 21-tool read-only Themis surface without breaking the legacy tool names.

**Architecture:** Keep core modules pure. Put bounded parsing and shared guidance builders in small protocol/core modules. Upgrade only the selected decision adapters additively; preserve legacy projections except where the gate report boundary must become an envelope projection. Guidance is calculated strict-first, and heuristic suggestions are append-only and never authoritative.

**Tech Stack:** Node.js ESM, `node:test`, `node:assert/strict`, existing `@deepseek-ai/dsh-tools`, npm artifact builder.

**Spec:** `docs/superpowers/specs/2026-08-26-dsh-themis-guidance-architecture.md` §§3, 4, 7, 8.

## Global Constraints

- No filesystem writes, subprocesses, network access, credential reads, profile mutation, or delegated execution in the plugin.
- Default guidance mode is `strict`; `heuristic` is explicit and cannot change strict outcomes.
- JSON text is measured in UTF-8 bytes before parsing.
- Safety-relevant incomplete scans return `SCAN_INCOMPLETE`, never success.
- Valid lifecycle outcomes (`CONTINUE`, `PAUSE`, `SCOPE-DOWN`, `PIVOT`, `STOP`) are `ok:true` analyses; malformed input is `ok:false`.
- Keep existing tool names and existing legacy fields during R6.
- Run a focused test after every implementation step and commit each task as a coherent unit.

## File Map

- Create: `packages/dsh-themis/src/core/budgets.js` — named budget profiles and bounded iterative inspection.
- Create: `packages/dsh-themis/src/core/guidance.js` — strict action normalization, ordering, provenance, heuristic append-only model.
- Modify: `packages/dsh-themis/src/protocol.js` — bounded JSON parsing and completeness metadata.
- Modify: `packages/dsh-themis/src/core/envelope.js` — explicit deterministic/reference-time and completeness metadata.
- Modify: `packages/dsh-themis/src/core/mutation.js` — fail-closed scan status.
- Modify: `packages/dsh-themis/src/core/gate.js`, `gates.js`, `progress.js`, `critical-path.js`, `impact.js`, `transition.js`, evidence modules — guidance and malformed-input semantics.
- Modify: `packages/dsh-themis/src/tools.js`, `tools/context.js`, `tools/progress.js`, `tools/gates.js`, `tools/mutation.js` — adapter wiring.
- Create: `tests/fixtures/starter-context.v1.json` — canonical starter input.
- Create/modify: `tests/r6-guidance.test.js`, `tests/artifact-smoke.test.js` — source and artifact regression coverage.
- Modify: `README.md`, `README.zh-CN.md`, `packages/dsh-themis/README.md` — starter loop and result semantics.

### Task 1: Establish bounded parsing and traversal primitives

**Files:** Create `packages/dsh-themis/src/core/budgets.js`; modify `packages/dsh-themis/src/protocol.js`; test `tests/r6-guidance.test.js`.

**Interfaces:**
- Produce `parseBoundedJson(fieldName, value, profileName) -> {ok:true,value,inspection}|{ok:false,error}`.
- Produce `inspectBounded(value, profile) -> {complete,bytes,nodes,maxDepth,stoppedAt?}`.
- Profiles: `default`, `state`, `graph`, `release`, `mutation`; defaults include 256 KiB field bytes, 2,000 array items, 200 object keys, 10,000 nodes, depth 24.

- [ ] Write failing tests for UTF-8 byte rejection before parse, oversized arrays, too many keys, depth exhaustion, node exhaustion, and valid small JSON.
- [ ] Run `node --test tests/r6-guidance.test.js`; expect failures because helpers do not exist.
- [ ] Implement iterative inspection with explicit `stoppedAt:{kind,path,limit}` and no recursive unbounded clone.
- [ ] Export `parseBoundedJson` from `protocol.js` and preserve `parseJsonString` as a compatibility wrapper only where callers have not migrated.
- [ ] Run focused tests; expect all new budget tests to pass.
- [ ] Commit: `feat(r6): add bounded input and traversal contracts`.

### Task 2: Migrate every JSON-string adapter to bounded parsing

**Files:** Modify `packages/dsh-themis/src/tools.js`, `src/tools/context.js`, `src/tools/progress.js`, `src/tools/gates.js`, `src/tools/mutation.js`; test `tests/r6-guidance.test.js`.

- [ ] Add tests proving each JSON parameter rejects oversized text before domain execution.
- [ ] Add tests distinguishing omitted optional fields from supplied malformed fields; specifically `reports:"nope"` must yield `BAD_REPORTS`.
- [ ] Replace direct `JSON.parse` helpers with `parseBoundedJson` and named profiles.
- [ ] Ensure malformed gate reports cannot produce a passing result.
- [ ] Run `node --test tests/r6-guidance.test.js` and the existing legacy/core test files.
- [ ] Commit: `fix(r6): route public JSON inputs through bounded parser`.

### Task 3: Make mutation safety fail closed

**Files:** Modify `packages/dsh-themis/src/core/mutation.js`; test `packages/dsh-tech-lead-core/tests/mutation.test.js` if source mirror is maintained and `tests/artifact-smoke.test.js`.

- [ ] Replace silent `{depth > 24}` and marker-count exits with a traversal result containing `complete:false`.
- [ ] Map depth/node/byte exhaustion to `errorEnvelope('mutation_preview','SCAN_INCOMPLETE',...)`.
- [ ] Keep executable operation checks case-insensitive and preserve `CAPABILITY_DENIED` for actual markers.
- [ ] Change the existing beyond-depth artifact assertion: nested `deploy` must not return `ok:true`; assert `SCAN_INCOMPLETE`.
- [ ] Add tests for sibling traversal, exact boundary, and marker plus budget exhaustion.
- [ ] Run focused mutation tests and artifact smoke.
- [ ] Commit: `fix(r6): fail closed on incomplete mutation scans`.

### Task 4: Add shared strict Guidance Contract

**Files:** Create `packages/dsh-themis/src/core/guidance.js`; modify relevant core modules; test `tests/r6-guidance.test.js`.

- [ ] Write tests for `makeAction({kind,targetId,reasonCodes,findingRef,action,doneWhen,nextTool})`, stable ordering, consecutive priorities, and missing-ID findings.
- [ ] Implement `normalizeGuidance` with fixed ordering: safety, gates, dependencies, evidence, assumptions, ready work, hygiene.
- [ ] Require `actionId`, `findingRef`, `reasonCodes`, `doneWhen`, and `nextTool` when a registered target tool exists.
- [ ] Add `heuristics` only under explicit `guidanceMode:"heuristic"`; include confidence, applicableWhen, smallestExperiment, and cannotProve.
- [ ] Ensure heuristic arrays cannot mutate strict action arrays or domain values.
- [ ] Run focused tests and commit: `feat(r6): add evidence-bounded guidance contract`.

### Task 5: Upgrade progress and critical-path decisions

**Files:** Modify `src/core/progress.js`, `src/core/critical-path.js`, `src/tools/progress.js`; test `tests/r6-guidance.test.js` and artifact smoke.

- [ ] Test blockers with IDs produce ordered actions and `resumeWhen` predicates.
- [ ] Preserve `blockingGateIds`, `blockedDependencyIds`, and `staleEvidenceIds`; reject missing identifiers instead of emitting `unknown` for strict guidance.
- [ ] Return valid `PAUSE`/`PIVOT` as `ok:true, code:"OK"` at the adapter while retaining domain `allowed:false`.
- [ ] Add `readyNow`, `nextWave`, `blockedBy`, and `scheduleSemantics` to critical-path output.
- [ ] Add explicit `optionsJson` parsing and invalid guidance mode rejection.
- [ ] Run focused, legacy, composition, and artifact tests.
- [ ] Commit: `feat(r6): guide progress and readiness waves`.

### Task 6: Upgrade gate, evidence, impact, and transition guidance

**Files:** Modify `src/core/gate.js`, `gates.js`, `evidence.js`, `evidence-graph.js`, `impact.js`, `transition.js`, `tools/gates.js`, `tools/context.js`, `tools.js`; test focused and artifact suites.

- [ ] Test `closurePlan.passWhen` for missing roles, conditional verdicts, reject findings, and quorum shortfalls.
- [ ] Test evidence refresh actions reference evidence IDs/fingerprints and high-risk gaps name `minimumRequiredLevel:"E3"`.
- [ ] Test impact output contains `triggeredBy` and gate-specific actions.
- [ ] Test transition output contains `requiredStateChanges` for PIVOT/SCOPE-DOWN/STOP.
- [ ] Upgrade `gate_precheck` malformed report handling to an object envelope projection while preserving `data.pass` and `data.violations`.
- [ ] Ensure valid gate non-pass returns `ok:true, code:"OK", data.pass:false`; reserve `ok:false` for invalid input and incomplete scans.
- [ ] Run tests and commit: `feat(r6): add gate and evidence closure guidance`.

### Task 7: Complete completeness and determinism semantics

**Files:** Modify `src/protocol.js`, `src/core/envelope.js`, `src/core/resume.js`, `src/core/release.js`; test focused and artifact suites.

- [ ] Test every truncatable result carries `complete:false`, returned/observed/limit metadata, or fails closed when legacy shape cannot carry metadata.
- [ ] Run all release detectors independently on a line containing path, token, and credential assignment markers.
- [ ] Add pinned `referenceTime` behavior for freshness-sensitive strengthened tools.
- [ ] Mark runtime-clock legacy resume output `deterministic:false` when no valid reference time is supplied, without changing its default bare shape.
- [ ] Run full test suite and commit: `fix(r6): make completeness and clock semantics explicit`.

### Task 8: Ship starter fixture, docs, and artifact gate

**Files:** Create `tests/fixtures/starter-context.v1.json`; modify three READMEs and `tests/artifact-smoke.test.js`.

- [ ] Add a complete context v1 fixture with stable IDs, inline source, fingerprint, current tier, arrays, and a non-empty next step.
- [ ] Document exact starter handoffs: classify tier -> `current.tier`; context -> evidence array; evidence findings -> progress input.
- [ ] Document `ok:true` lifecycle semantics and strict/heuristic distinction.
- [ ] Add artifact tests for new guidance, incomplete scans, malformed reports, and starter fixture imports.
- [ ] Run `npm test`, `node --test tests/artifact-smoke.test.js`, and `npm run test:composition`.
- [ ] Commit: `docs(r6): document starter loop and guidance semantics`.

### Task 9: R6 release verification

- [ ] Run source tests, composition tests, artifact tests, `git diff --check`, and package build.
- [ ] Inspect tarball contents; confirm no new imports of filesystem, child process, network, or credential APIs.
- [ ] Run a clean profile install of the built artifact and verify exactly 21 tools.
- [ ] Publish only after the release checklist confirms version, README, directory, patch row, and deprecation boundaries.
- [ ] Record residual risks: legacy bare outputs, no persistent handoff, and heuristic guidance is non-authoritative.
