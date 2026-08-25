# DSH Tech Lead 强化版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 DSH tech-lead 插件从 9 个独立只读校验工具升级为可组合、可续跑、证据驱动的只读工程治理运行时。

**Architecture:** 保留 `dsh-tech-lead-core` 纯函数、零依赖、零 I/O 边界；在其上增加统一 ResultEnvelope、ContextSnapshot、证据图、推进、关键路径、影响与对账模块。plugin 层按领域注册工具并负责 DSH 字符串协议，bundle 层保持最小 patch 接入。所有阶段默认只读，MutationIntent 只生成预览。

**Tech Stack:** Node.js >=16 runtime，Node.js `node:test`，ESM core/plugin，DSH tools registry，vendored Cordis composition harness。

**Spec:** `docs/superpowers/specs/2026-08-25-dsh-tech-lead-strengthening-design.md`

## Global Constraints

- Phase 0-4 plugin 无 `fs`、`child_process`、网络、`process.env`、秘密读取或 profile 修改路径。
- 现有 9 个工具的输入参数和业务结果保持兼容；统一 envelope 只通过明确的兼容模式逐步启用。
- core 所有业务失败返回结构化结果，不抛异常；plugin 解析失败返回 `BAD_INPUT`。
- 复合参数继续使用 JSON string，列表参数继续使用 CSV，适配 DSH schema 限制。
- 每个阶段必须先添加失败测试，再写生产代码；测试不过不得进入下一阶段。
- 不提交、不推送、不发布，除非用户明确要求。
- 三个 DSH profile 的配置变更必须先备份并独立验证；本计划默认不改 profile。

---

## Task M0.1: 结果协议与输入协议

**Files:**
- Create: `packages/dsh-tech-lead-core/src/envelope.js`
- Create: `packages/dsh-tech-lead-plugin/src/protocol.js`
- Test: `packages/dsh-tech-lead-core/tests/envelope.test.js`
- Test: `packages/dsh-tech-lead-plugin/test/protocol.test.js`
- Modify: `packages/dsh-tech-lead-core/src/index.js`

**Interfaces:**
- `makeEnvelope({ ok, code, data, errors, warnings, operation, meta }) -> object`
- `okEnvelope(operation, data, warnings?) -> ResultEnvelopeV1`
- `errorEnvelope(operation, code, errors, data?) -> ResultEnvelopeV1`
- `parseJsonString(value, path) -> { ok:true,value } | { ok:false,error }`
- `csv(value) -> string[]`
- `renderEnvelope(value) -> string`

- [x] Step 1: Write a failing core test asserting success envelopes contain exactly `ok/code/data/errors/warnings/meta`, with `meta.schema === "tech-lead.result.v1"`, `deterministic === true`, and `sideEffects === false`.
- [x] Step 2: Run `node --test packages/dsh-tech-lead-core/tests/envelope.test.js`; confirm failure is missing `envelope.js` export, not a test error.
- [x] Step 3: Implement deterministic envelope constructors with defensive array normalization and operation metadata.
- [x] Step 4: Add plugin protocol tests for malformed JSON, whitespace CSV, null input, and stable pretty JSON rendering.
- [x] Step 5: Implement `protocol.js` without importing filesystem, process, network, or child process modules.
- [x] Step 6: Run both focused tests and confirm green.
- [x] Step 7: Run `git diff --check` and record M0.1 evidence in the plan.

## Task M0.2: Capability Catalog

**Files:**
- Create: `packages/dsh-tech-lead-core/src/capabilities.js`
- Test: `packages/dsh-tech-lead-core/tests/capabilities.test.js`
- Modify: `packages/dsh-tech-lead-core/src/index.js`
- Modify: `packages/dsh-tech-lead-plugin/src/index.js`
- Test: `packages/dsh-tech-lead-plugin/test/capabilities.test.js`

**Interfaces:**
- `TECH_LEAD_CAPABILITIES -> readonly capability descriptor[]`
- `getCapabilities() -> descriptor[]` returning a defensive copy
- Descriptor fields: `{ name, version, domain, sideEffects:false, inputMode, risk, deprecated? }`

- [x] Step 1: Add failing tests for catalog uniqueness, mandatory fields, `sideEffects:false`, and defensive-copy behavior.
- [x] Step 2: Run focused tests and confirm the catalog is absent.
- [x] Step 3: Implement the catalog for the existing 9 tools and later strengthened surface.
- [x] Step 4: Expose `getCapabilities` from plugin index without changing the existing `name/inject/apply` exports.
- [x] Step 5: Run core, plugin, and existing composition tests; confirm `TLT-PASS 21/21`.

## Task M0.3: Backward-Compatible Plugin Registration

**Files:**
- Modify: `packages/dsh-tech-lead-plugin/src/tools.js`
- Modify: `packages/dsh-tech-lead-plugin/src/index.js`
- Create: `packages/dsh-tech-lead-plugin/src/tools/basic.js`
- Test: `packages/dsh-tech-lead-plugin/test/legacy-contract.test.js`
- Modify: `packages/dsh-tech-lead-plugin/test/composition/driver.ts`

- [x] Step 1: Add a failing contract test that loads the plugin and checks the original 9 names plus strengthened tool contracts.
- [x] Step 2: Run the test and confirm the modular registration entry is absent or the envelope contract is not yet asserted.
- [x] Step 3: Keep the legacy registration body stable and add domain registration shims without behavior changes.
- [x] Step 4: Keep `tools.js` as the compatibility registration shim so existing imports continue to work.
- [x] Step 5: Update `index.js` to pass all core domains while preserving `apply(ctx)` behavior.
- [x] Step 6: Add negative plugin contract paths and assert malformed calls produce structured text rather than process failure.
- [x] Step 7: Run `node tests/run-tests.js` and the real Cordis composition harness; `88` core/static tests and `TLT-PASS 21/21` are green.

## M0 Gate: Contract Freeze

- [ ] Confirm existing 9-tool behavior is backward compatible.
- [ ] Confirm every new protocol test is green.
- [ ] Run static scan for forbidden imports and side-effect APIs.
- [ ] Record exact commands and outputs in the phase evidence note.
- [ ] Only after this gate, begin M1.

## Task M1.1: Context Snapshot Validator

**Files:**
- Create: `packages/dsh-tech-lead-core/src/context.js`
- Test: `packages/dsh-tech-lead-core/tests/context.test.js`
- Modify: `packages/dsh-tech-lead-core/src/index.js`

**Interfaces:**
- `validateContext(raw) -> { valid, errors, warnings, unknownFields }`
- `normalizeContext(raw) -> normalizedContext`
- Required schema: `tech-lead.context.v1`, inline source, current mode/tier/phase, and array ledgers.

- [ ] Step 1: Write failing tests for a valid snapshot, missing goal ledger, invalid current enums, unknown fields, and non-inline source.
- [ ] Step 2: Run focused tests and verify expected missing export failure.
- [ ] Step 3: Implement schema validation with stable JSON-pointer-like error paths.
- [ ] Step 4: Implement deterministic normalization: preserve semantic unknown fields as warnings, sort only identity-bearing collections where specified, never mutate input.
- [ ] Step 5: Run context tests and all prior tests.

## Task M1.2: Evidence Graph and Freshness

**Files:**
- Create: `packages/dsh-tech-lead-core/src/evidence-graph.js`
- Test: `packages/dsh-tech-lead-core/tests/evidence-graph.test.js`
- Modify: `packages/dsh-tech-lead-core/src/index.js`

**Interfaces:**
- `evidenceGraphLint(context, opts?) -> { valid, findings, graph }`
- `evidenceFreshness(context, { now, maxAgeDays, fingerprint }) -> { stale, findings, evidence }`

- [ ] Step 1: Add failing tests for supported goal, orphan evidence, missing evidence reference, invalid relation, stale timestamp, future timestamp, scope mismatch, and fingerprint drift.
- [ ] Step 2: Run focused tests and confirm failure.
- [ ] Step 3: Implement graph construction over explicit IDs and references only; never infer relationships from free-form text.
- [ ] Step 4: Implement freshness rules with default 7 days, invalid option fallback warning, and deterministic timestamp comparison.
- [ ] Step 5: Run focused plus full core tests.

## Task M1.3: Context Plugin Tools

**Files:**
- Create: `packages/dsh-tech-lead-plugin/src/tools/context.js`
- Modify: `packages/dsh-tech-lead-plugin/src/index.js`
- Test: `packages/dsh-tech-lead-plugin/test/context-tools.test.js`
- Modify: `packages/dsh-tech-lead-plugin/test/composition/driver.ts`

**Tools:**
- `tech_lead_context_validate`
- `tech_lead_evidence_graph_lint`
- `tech_lead_evidence_freshness`
- `tech_lead_assumption_register`

- [ ] Step 1: Add failing plugin contract tests for schema, JSON-string parsing, `BAD_INPUT`, and expected data fields.
- [ ] Step 2: Run focused tests and confirm the four tools are missing.
- [ ] Step 3: Implement thin adapters using `protocol.js` and core functions; assumption register remains deterministic analysis, not storage.
- [ ] Step 4: Add the four tools to capability catalog and composition workflow.
- [ ] Step 5: Run composition tests with a valid and invalid context; assert valid errors cannot be mistaken for success.

## M1 Gate: Context and Evidence

- [ ] Core context/evidence tests green.
- [ ] Plugin contract tests green.
- [ ] Composition workflow demonstrates context → evidence.
- [ ] Static scan still proves zero I/O.

## Task M2.1: Progress Decision Engine

**Files:**
- Create: `packages/dsh-tech-lead-core/src/progress.js`
- Test: `packages/dsh-tech-lead-core/tests/progress.test.js`
- Modify: `packages/dsh-tech-lead-core/src/index.js`

**Interface:**
- `progressDecide(context, opts?) -> { outcome, allowed, reasons, blockers, requiredActions, confidence }`

- [ ] Step 1: Write failing tests for each outcome, blocked dependency, stale evidence, open destructive Gate, pivot evidence, scope-down evidence, and stop conditions.
- [ ] Step 2: Run focused tests and verify the missing function failure.
- [ ] Step 3: Implement precedence: safety block → stale/insufficient evidence → dependency blocker → gate state → goal progress → continue.
- [ ] Step 4: Return reasons with stable IDs and never claim user outcome validation from local evidence.
- [ ] Step 5: Run focused and full tests.

## Task M2.2: Critical Path and Impact

**Files:**
- Create: `packages/dsh-tech-lead-core/src/critical-path.js`
- Create: `packages/dsh-tech-lead-core/src/impact.js`
- Test: `packages/dsh-tech-lead-core/tests/critical-path.test.js`
- Test: `packages/dsh-tech-lead-core/tests/impact.test.js`
- Modify: `packages/dsh-tech-lead-core/src/index.js`

**Interfaces:**
- `criticalPath(tasks, dependencies, opts?) -> { blockers, criticalPath, parallelWindows, findings }`
- `changeImpact(change, context) -> { tier, assets, reversible, blastRadius, reopenGates, reasons }`

- [ ] Step 1: Add failing graph tests for chain, branch, cycle, unknown dependency, completed blocker, and independent parallel tasks.
- [ ] Step 2: Add failing impact tests for source-only, public-interface, protected asset, irreversible, and cross-module changes.
- [ ] Step 3: Implement deterministic graph traversal with cycle findings instead of infinite recursion.
- [ ] Step 4: Implement impact aggregation using the existing T0/T1/T2 rules and explicit change metadata only.
- [ ] Step 5: Run focused and full core tests.

## Task M2.3: Progress Plugin Tools

**Files:**
- Create: `packages/dsh-tech-lead-plugin/src/tools/progress.js`
- Modify: `packages/dsh-tech-lead-plugin/src/index.js`
- Test: `packages/dsh-tech-lead-plugin/test/progress-tools.test.js`
- Modify: `packages/dsh-tech-lead-plugin/test/composition/driver.ts`

**Tools:**
- `tech_lead_progress_decide`
- `tech_lead_critical_path`
- `tech_lead_change_impact`
- `tech_lead_resume_reconcile`

- [ ] Step 1: Add failing contract tests for all four tools and malformed nested JSON.
- [ ] Step 2: Implement thin adapters with uniform envelope output.
- [ ] Step 3: Add composition path evidence → progress → critical path.
- [ ] Step 4: Run all tests and require no false success on blocked inputs.

## M2 Gate: Progress Engine

- [ ] All progress, path, impact, and reconcile tests green.
- [ ] At least one composition case returns `PAUSE` with a concrete blocker.
- [ ] At least one composition case returns `CONTINUE` with evidence-backed reasons.
- [ ] Cycle and stale evidence cases terminate deterministically.

## Task M3.1: Gate Planning and Aggregation

**Files:**
- Create: `packages/dsh-tech-lead-core/src/gates.js`
- Test: `packages/dsh-tech-lead-core/tests/gates.test.js`
- Modify: `packages/dsh-tech-lead-core/src/index.js`

**Interfaces:**
- `gatePlan(context, impact) -> { requiredRoles, minimumEvidence, quorum, conditions }`
- `gateAggregate(reports, plan) -> { verdict, pass, findings, reopen, unresolved }`
- `gateReopen(previousGate, currentContext) -> { reopen, reasons, changedInputs }`

- [ ] Step 1: Write failing tests for low-risk solo, destructive four-role, missing role, duplicate reviewer, reject propagation, conditional verdict, stale report, and snapshot drift.
- [ ] Step 2: Run focused tests and confirm missing module failure.
- [ ] Step 3: Implement explicit role/quorum rules; do not count duplicate reports or unanchored praise.
- [ ] Step 4: Implement reject propagation and deterministic finding de-duplication by finding ID/location.
- [ ] Step 5: Implement gate reopen on context fingerprint, evidence freshness, dependency, and impact changes.
- [ ] Step 6: Run focused and full core tests.

## Task M3.2: Gate Plugin Tools

**Files:**
- Create: `packages/dsh-tech-lead-plugin/src/tools/gates.js`
- Modify: `packages/dsh-tech-lead-plugin/src/index.js`
- Test: `packages/dsh-tech-lead-plugin/test/gate-tools.test.js`
- Modify: `packages/dsh-tech-lead-plugin/test/composition/driver.ts`

**Tools:**
- `tech_lead_gate_plan`
- `tech_lead_gate_aggregate`
- `tech_lead_gate_reopen`

- [ ] Step 1: Add failing tests for input schema and output envelope.
- [ ] Step 2: Implement adapters and add negative cases for missing anchors and reject propagation.
- [ ] Step 3: Extend composition to context → evidence → progress → gate → reconcile.
- [ ] Step 4: Run the full composition harness and assert every failure branch is distinguishable from `OK`.

## M3 Gate: Gate Orchestration

- [ ] PM/Arch/Eng/Ops role behavior covered.
- [ ] Destructive scope cannot pass solo.
- [ ] Reject and stale report force non-pass.
- [ ] Drift reopens affected Gate only and reports changed inputs.

## Task M4.1: Mutation Intent Preview

**Files:**
- Create: `packages/dsh-tech-lead-core/src/mutation.js`
- Test: `packages/dsh-tech-lead-core/tests/mutation.test.js`
- Create: `packages/dsh-tech-lead-plugin/src/tools/mutation.js`
- Test: `packages/dsh-tech-lead-plugin/test/mutation-tools.test.js`
- Modify: `packages/dsh-tech-lead-core/src/index.js`
- Modify: `packages/dsh-tech-lead-plugin/src/index.js`

**Interfaces:**
- `validateMutationIntent(raw) -> { valid, errors, warnings }`
- `previewMutation(raw) -> ResultEnvelopeV1`

- [ ] Step 1: Write failing tests proving `read-only-preview` succeeds only with target, expected diff, recovery point, verification, and missing authorization status.
- [ ] Step 2: Write failing tests proving `apply`, `execute`, `deploy`, or unknown modes return `CAPABILITY_DENIED` and never call an executor.
- [ ] Step 3: Implement pure validation and preview rendering; preserve commands as inert strings and never execute them.
- [ ] Step 4: Register `tech_lead_mutation_preview` with an explicit `sideEffects:false` capability.
- [ ] Step 5: Run focused tests and static side-effect scan.

## M4 Gate: Mutation Safety

- [ ] No apply path exists in source or bundle.
- [ ] Forbidden mode tests pass.
- [ ] Static scan finds no forbidden I/O imports or APIs.
- [ ] Preview output clearly states it is not execution.

## Task M5.1: Composition and Runtime Hardening

**Files:**
- Modify: `packages/dsh-tech-lead-plugin/test/composition/driver.ts`
- Modify: `packages/dsh-tech-lead-plugin/test/composition/cordis.yml`
- Create: `packages/dsh-tech-lead-plugin/test/composition/run.mjs`
- Modify: `packages/dsh-tech-lead-plugin/package.json` (cordis + plugin-loader/include devDependencies)
- Create: `tests/plugin-static-safety.test.js`
- Create: `tests/composition-workflow.test.js`
- Modify: `tests/run-tests.js`

- [x] Step 1: Add structured workflow coverage for valid context through the registered tool surface.
- [x] Step 2: Add negative coverage for stale evidence, JSON null roots, malformed Gate inputs, and executable mutation operations.
- [x] Step 3: Implement driver assertions for all new tool names and exact success marker.
- [x] Step 4: Add static scan over plugin/core source for forbidden APIs and unapproved dynamic imports.
- [x] Step 5: Run `npm test` and `npm run test:composition` (workspace-resolved Cordis loader; no global DSH path).

## Task M5.2: Documentation and Release Audit

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/TECHNICAL_GUIDE.md`
- Modify: `docs/AUDIT_REPORT.md`
- Modify: `packages/dsh-tech-lead-plugin/package.json`
- Modify: `packages/dsh-tech-lead-core/package.json`
- Modify: `packages/dsh-tech-lead-bundle/package.json`

- [x] Step 1: Review tool count, phase list, read-only boundary, and compatibility claims against the runtime.
- [x] Step 2: Update English and Simplified Chinese docs with the v0.2 capability list and source-checkout distribution boundary.
- [x] Step 3: Keep the root package publish allowlist limited to the skill and installer; private workspace packages remain local-path only.
- [x] Step 4: Run `npm pack --dry-run`, `git diff --check`, and documentation reference checks.
- [x] Step 5: Confirm no internal paths, tokens, server addresses, or user data enter the public package.

## Final Gate

- [x] Core tests green, including all old and new modules.
- [x] Plugin contract tests green for every registered tool.
- [x] Composition workflow coverage green.
- [x] `techtest`, `headless`, and `web` profile loading confirms the tech-lead bundle; pre-existing web skin warnings remain outside this bundle.
- [x] Static side-effect scan passes.
- [x] npm package inventory and release audit pass.
- [x] Working tree and remote state are reported accurately; publication requires explicit user request.
