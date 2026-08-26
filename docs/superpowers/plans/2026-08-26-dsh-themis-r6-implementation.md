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

## File Map (post-audit: edit workspace sources only)

`packages/dsh-themis` is GENERATED build output (builder rmSync + cpSync). Never edit it by hand except via the builder template.

- Create: `packages/dsh-tech-lead-core/src/budgets.js` — named budget profiles, inspectBounded, parseBoundedJson.
- Create: `packages/dsh-tech-lead-core/src/guidance.js` — strict action normalization/ordering/provenance; heuristic append-only; cap synthesized actions at 50.
- Re-export both from `packages/dsh-tech-lead-core/src/index.js`.
- Modify: `packages/dsh-tech-lead-plugin/src/protocol.js` — re-export parseBoundedJson; completeness/truncation metadata in clampEnvelope (meta only; makeEnvelope untouched).
- Modify core sources: `envelope.js` (honor explicit meta.deterministic:false; schema/sideEffects stay forced), `mutation.js`, `gate.js`, `gates.js` (closurePlan), `progress.js`, `critical-path.js`, `impact.js`, `transition.js`, `evidence.js`, `evidence-graph.js`, `release.js` (lift else-branch).
- Modify plugin sources: `tools.js` (legacy json() -> parseBoundedJson; gate_precheck envelope projection; header-comment eight-bare wording), `tools/context.js`, `tools/progress.js`, `tools/gates.js`, `tools/mutation.js` — adapters + description strings.
- Create: `tests/fixtures/starter-context.v1.json`; `tests/r6-guidance.test.js`; update `tests/artifact-smoke.test.js`.
- Docs: root README.md + README.zh-CN.md (both version lines set to v5.5.0; lifecycle-semantics + starter loop), docs/TECHNICAL_GUIDE.md(+zh) outcome sentence, docs/AUDIT_REPORT.md, skill/SKILL.md, builder README template.

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


---

## Execution Amendments (post-audit, normative — supersedes conflicting text above)

Derived from three-way audit + two-judge cross-validation @ 54680ab.

A1. **BAD_REPORTS split**: only `gate_precheck` treats supplied-wrong-typed `reports` as fail-closed (`pass:false` + violation type `BAD_REPORTS`; envelope `data.violations`). `gate_aggregate` keeps adapter `BAD_INPUT` for non-array `reportsJson`; invalid plan object stays `BAD_INPUT`. Parse-failures everywhere remain their existing domain-invalid shapes with the byte-identical message prefix `invalid JSON: ` (pins legacy-tools.test.js:40/:49).
A2. **Governance-negative uniform rule (§4.5 applied)**: every strengthened tool returns `ok:true, code:'OK'` for valid analyses regardless of outcome — includes progress PAUSE/PIVOT, gate_aggregate non-pass (data.verdict/findings/missingRoles; drop the derived GATE_BLOCKED wrapper), gate_reopen reopen=true (data.reopen, reasons as warnings), evidence_freshness stale=true (findings in data), resume_reconcile drift=true (changedKeys in data), assumption_register missing-verification entries (items + structured findings, not SCHEMA_INVALID). `ok:false` reserved for malformed input, budget/scan incompleteness, capability denial, INTERNAL. Mandatory pin flips: gate-tools.test.js:16-18, :43-50, :60-67; driver.ts gate_aggregate positive (~:141), freshness stale positive (~:103), reconcile positive (~:132), assumption positive if pinned; context-tools.test.js:31-34, :58-64.
A3. **Driver counts**: 21 positives / 12 negatives (verified programmatically). Update TLT expectations accordingly.
A4. **Envelope constructor**: honor caller `meta.deterministic:false`; schema/operation/sideEffects remain forced. Completeness metadata lives ONLY in clampEnvelope output (never emitted by makeEnvelope) so envelope.test.js:7-19 deepEqual stays green. Echo-collapse objects are never mutated; truncation info goes to `meta.truncation` alongside (not replacing) existing FINDINGS_TRUNCATED warning.
A5. **C4 site = adapter-side**: plan_lint/evidence_lint/release_audit adapters check result length before `out()`; >500 => `{ok:false,code:'SCAN_INCOMPLETE',data:{legacy:first500},errors:[{code,message,details:{observed,limit}}]}`. protocol.test.js:82-88 therefore survives untouched. Add new >500 fixture tests per adapter.
A6. **Mutation**: beyond-depth/budget marker scans return SCAN_INCOMPLETE (ok:false). Rewrite tool description (drop "within depth 24 levels" denial claim; add SCAN_INCOMPLETE). Update mutation.test.js:85 and artifact-smoke:61.
A7. **MISSING_ID contract**: `blockers`/`staleEvidenceIds`/`blockedDependencyIds` remain string[] and silently EXCLUDE id-less entries; each excluded entry adds `{code:'MISSING_ID', path:'/…', id:'missing:<collection>:<index>'}` to `reasons`. Not applied to critical-path (its INVALID_TASK_ID already covers). No gateAggregate dedup interaction (different module).
A8. **guidance.nextActions**: hard cap 50 synthesized actions in guidance.js (deterministic order, priorities 1..n); documented in descriptions; avoids ECHO/clamp ambiguity entirely.
A9. **Determinism metadata**: when runtime clock used (resume_card without parseable nowIso; freshness without options.now), emit `meta.deterministic:false` + `meta.clockSource:'runtime'` where envelope exists; resume_card legacy bare shape gets documentation-only treatment (README sentence), plus `clockSource` hint appended into its `warnings` array as a string.
A10. **Prose sweep (must land in the same commits as behavior)**: tools.js:14-15 header (eight-bare + adapter-side completeness), tools.js gate_precheck description (~:131 "Returns envelope with data.pass/data.violations"), tools/progress.js:9 description, tools/mutation.js:7 description, AUDIT_REPORT.md:51 nine/twelve wording, TECHNICAL_GUIDE(.zh-CN).md outcome-table sentence "PAUSE/PIVOT/SCOPE-DOWN/STOP return as ok:true analyses; ok:false reserved for malformed input and incomplete scans", README(.zh-CN) same semantics paragraph + starter loop.
A11. **Static-safety**: keep scan scope {core/src, plugin/src}; CONSTRAINT: new source files must not contain literal tokens `fetch(`, `Sync(`, `process.env.` even in comments/JSDoc — such rationale text lives only in README/tests.
A12. **Versions**: builder:71 -> '1.1.0'; root package.json -> 5.5.0; SKILL.md:6 & AUDIT_REPORT:38 -> v5.5.0; README.md:140 AND README.zh-CN.md:140 both SET to `v5.5.0` (overwrite drifted 5.4.6/5.4.5; do not increment locally).
A13. **Release discipline**: after workspace edits, run builder; `git status` MUST show regenerated packages/dsh-themis tree; include it in the release commit; verify tarball contains budgets.js+guidance.js; clean-profile install shows exactly 21 tools; publish subpackage then root; no CHANGELOG file is created (AUDIT_REPORT version bullet carries notes).
