# DSH Themis Guidance Architecture

Date: 2026-08-26

Status: proposed for review

Scope: R6-R8 architectural evolution of `dsh-themis`. This document does not authorize implementation.

## 1. Decision Summary

`dsh-themis` should evolve from a collection of 21 read-only governance validators into a read-only, evidence-bounded governance copilot.

The product must preserve these invariants:

1. No filesystem writes, subprocesses, network access, credential reads, profile mutation, or delegated execution.
2. Gate verdicts and safety checks are deterministic functions of caller-supplied input in strict mode.
3. Incomplete safety inspection fails closed. A bounded scan may never report a successful safety decision when unscanned input can affect that decision.
4. Lifecycle decisions such as `PAUSE`, `PIVOT`, `SCOPE-DOWN`, and `STOP` are valid outcomes, not tool failures.
5. Guidance is advisory. It proposes evidence-backed next actions but never claims to have performed them or changes caller state.
6. Existing tool names and existing result fields remain available through R6. New fields are additive.

The approved guidance policy is dual-mode:

| Mode | Default | Allowed basis | Gate effect |
|---|---:|---|---|
| `strict` | yes | Explicit input, deterministic rules, and declared policy | May inform gate closure and lifecycle outcome |
| `heuristic` | no | Strict result plus bounded, labeled operational heuristics | Never changes gate pass/fail or overrides strict blockers |

`heuristic` recommendations must include a confidence value, applicability conditions, and a smallest falsifiable experiment. They are never evidence, approval, or authorization.

## 2. Current-State Evidence

### 2.1 Strengths to retain

The shipped package is a small, self-contained ESM bundle:

- `packages/dsh-themis/package.json` declares one runtime dependency, `@deepseek-ai/dsh-tools`.
- `packages/dsh-themis/cordis.patch.yml` exposes exactly one bundle row, `tech-lead-tools` / `dsh-themis`.
- `packages/dsh-themis/src/core/` contains pure calculation modules and has no intended I/O surface.
- The package exposes 21 read-only tools through `src/tools.js` and `src/core/capabilities.js`.
- `tests/artifact-smoke.test.js` executes the assembled npm artifact rather than only workspace sources.
- The current full suite has 182 passing tests.

These are not to be replaced by a persistent orchestrator, executor, or agent runtime. The value proposition remains safe preflight, evidence interpretation, and decision support.

### 2.2 Guidance gap

Several current outputs diagnose state but do not close the loop.

- `core/progress.js` identifies stale evidence, dependencies, and destructive gates, then returns the generic instruction `resolve blockers and refresh evidence`.
- `core/critical-path.js` reports graph topology, but does not identify immediately runnable tasks or the next release wave.
- `core/gates.js` returns missing roles and conditional/reject results, but does not express the smallest report set or predicates needed to close the gate.
- Evidence and assumption checks report invalid or stale records but do not identify the narrowest proof needed to replace them.
- Capability descriptors identify a name, domain, input mode, risk, and side-effect flag, but do not state prerequisites, follow-on tools, or user-facing decision meaning.

The resulting burden is placed on the caller: it must interpret 21 peer tools, reshape JSON between calls, determine whether an `ok:false` result is an expected lifecycle decision, and infer what to do next.

### 2.3 Safety and contract gaps

The following current behaviors require R6 remediation.

| ID | Current behavior | Why it is unsafe or misleading | R6 disposition |
|---|---|---|---|
| S1 | `core/mutation.js` stops marker scanning after depth 24 and can return a successful preview | Unsafe content can exist beyond the scan budget | Fail closed with `SCAN_INCOMPLETE` |
| S2 | `core/gate.js` coerces non-array reports to `[]` | Supplied malformed review data can be treated as no review data | Reject supplied malformed reports as `BAD_REPORTS` |
| S3 | `protocol.js` limits rendered output only after unbounded JSON parsing and traversal | Large input can consume CPU/memory before an advertised limit applies | Enforce byte, item, node, and depth budgets before/during work |
| S4 | Some freshness code uses wall-clock time while ResultEnvelope declares deterministic output | Same input can differ by invocation time | Require a reference time in strict mode or mark result nondeterministic |
| S5 | Legacy tools use bare shapes, strengthened tools use envelopes, and lifecycle decisions may be errors | Consumers cannot uniformly distinguish invalid input, blocked governance, and valid pause | Add common result semantics and a migration path |
| S6 | Top-level bare arrays can be sliced silently | Consumers can mistake partial findings for exhaustive findings | Add explicit completeness/truncation indicators |
| S7 | Release scan uses an `if/else` chain per line | One line containing several leak classes can lose findings | Run all detectors independently |

## 3. Product Model

### 3.1 What Themis is

Themis is a governance reasoning surface. It accepts an inline project snapshot, calculates policy outcomes, and supplies a bounded route from the current evidence state to the next verifiable state.

It is not:

- a task runner;
- a project database;
- an autonomous planning agent;
- a replacement for human approval;
- a source of production truth beyond caller-supplied evidence;
- an execution capability concealed behind a preview name.

### 3.2 Guidance contract

R6 adds a shared additive `guidance` field to applicable decision responses. The field is omitted only when the result has no useful next step.

```json
{
  "guidance": {
    "mode": "strict",
    "decision": {
      "outcome": "PAUSE",
      "meaning": "A destructive action is blocked until its gate passes."
    },
    "nextActions": [
      {
        "priority": 1,
        "kind": "gate",
        "targetId": "release-gate",
        "action": "Obtain the missing anchored architecture review.",
        "reasonCodes": ["MISSING_ROLE"],
        "doneWhen": "reports contains a valid arch report with verdict pass",
        "nextTool": "tech_lead_gate_aggregate"
      }
    ],
    "resumeWhen": [
      "release-gate has pass status",
      "all actions with priority 1 are complete"
    ]
  }
}
```

Field rules:

| Field | Rule |
|---|---|
| `mode` | `strict` or explicit `heuristic` |
| `decision.outcome` | One of `CONTINUE`, `PAUSE`, `SCOPE-DOWN`, `PIVOT`, `STOP`, or `NONE` |
| `nextActions` | Deterministically ordered, maximum 10 items |
| `priority` | Consecutive integers beginning at 1 |
| `targetId` | Must reference a caller-supplied identifier or be absent when no stable identifier exists |
| `reasonCodes` | Must correspond to an output finding or rule trigger |
| `doneWhen` | Declarative completion predicate, not an unbounded command or subjective phrase |
| `nextTool` | One registered Themis tool name or absent |
| `resumeWhen` | Necessary conditions for another decision pass, not evidence that work happened |

Strict action ordering is fixed:

1. Capability/safety incompleteness and malformed input.
2. Destructive or required gate failures.
3. Blocking external dependencies.
4. Invalid or stale evidence affecting the chosen action.
5. Missing assumption verification.
6. Immediately runnable critical-path work.
7. Optional hygiene work.

The ordering prevents cosmetic cleanup from hiding a blocked critical path.

### 3.3 Heuristic guidance

Heuristic mode is requested by an explicit `guidanceMode: "heuristic"` option on R6 decision tools. It retains all strict findings and can append `heuristics`:

```json
{
  "heuristics": [
    {
      "id": "H-DEPENDENCY-ALTERNATIVE",
      "confidence": 0.45,
      "applicableWhen": ["dependency upstream-api is blocked", "no fallback is declared"],
      "suggestion": "Evaluate one fallback provider before expanding unrelated implementation work.",
      "smallestExperiment": "Record a read-only compatibility probe against the declared fallback interface.",
      "cannotProve": ["availability", "authorization", "production readiness"]
    }
  ]
}
```

Requirements:

- `confidence` is a bounded number in `[0,1]`.
- The result must state what the heuristic cannot prove.
- Heuristics cannot change `pass`, `allowed`, `verdict`, required roles, minimum evidence, or a strict outcome.
- Heuristics must never request shell commands, network access, secret access, writing, deployment, or execution. They may name a category of verification the caller can perform through its own approved process.

## 4. R6: Safe Guidance Foundation

### 4.1 Scope

R6 is intentionally narrow:

1. Correct fail-open safety and input-boundary behavior.
2. Add strict/heuristic Guidance Contract to selected existing decision tools.
3. Normalize the semantics of valid lifecycle outcomes.
4. Publish a narrow four-tool starter loop.

R6 does not create a persistent state store, a universal orchestration tool, a schema-v2 migration, write tools, network probes, or action execution.

### 4.2 Fail-closed inspection budgets

Every public tool that accepts serialized JSON receives an input budget before parsing:

| Budget | R6 default | Result when exceeded |
|---|---:|---|
| JSON text bytes per field | 256 KiB | `INPUT_TOO_LARGE` |
| Parsed array length | 2,000 | `ITEM_LIMIT_EXCEEDED` |
| Object keys per object | 200 | `ITEM_LIMIT_EXCEEDED` |
| Traversed nodes | 10,000 | `SCAN_INCOMPLETE` |
| Semantic scan depth | 24 | `SCAN_INCOMPLETE` |
| Output findings | 500 | `complete:false` plus truncation metadata |

The exact numbers are defaults, not a guarantee that every tool needs every budget. A tool may use a lower budget when its algorithm is quadratic or graph-oriented. Any budget that affects a safety, release, mutation, or governance decision must fail closed.

`renderEnvelope` remains a rendering-size safeguard, but cannot be the primary resource control. Input validation must happen before expensive traversal.

### 4.3 Mutation preview boundary

`tech_lead_mutation_preview` remains preview-only.

New behavior:

- A marker, executable operation, oversized input, scan depth exhaustion, or node budget exhaustion returns a non-success result.
- Scan depth exhaustion returns `SCAN_INCOMPLETE`, not `ok:true`.
- The result identifies the unscanned path prefix and budget that stopped inspection when available.
- Case-insensitive executable operation matching applies to operation values as well as text markers.
- A marker-free preview says only `execution: "not performed"`; it does not claim approval or safety for a future execution system.

### 4.4 Gate input boundary

`gatePrecheck` and `gateAggregate` distinguish these cases:

| Input condition | Treatment |
|---|---|
| `reports` omitted where optional | Valid omission, subject to the plan’s rules |
| `reports` supplied as a non-array | `BAD_REPORTS` |
| report element malformed | `INVALID_REPORT` and a blocked/non-passing aggregate |
| report array exceeds budget | `SCAN_INCOMPLETE` and a blocked/non-passing aggregate |
| plan missing required roles/quorum | `INVALID_PLAN` |

No malformed report container may be silently normalized to an empty report list.

### 4.5 Lifecycle result semantics

New R6 tools and upgraded strengthened tools use the same high-level shape:

```json
{
  "ok": true,
  "code": "OK",
  "data": {
    "outcome": "PAUSE"
  },
  "guidance": {}
}
```

Rules:

- `ok:true` means the tool understood the input and produced a valid analysis, regardless of lifecycle outcome.
- `ok:false` is reserved for malformed input, unsupported schema version, capability denial, incomplete safety scan, resource limit, or unexpected internal failure.
- A non-passing governance state is represented by `data.outcome`, `data.verdict`, `data.pass`, and structured findings, not by converting the analysis itself into an error.
- Existing legacy output fields remain present during R6. Their wrapper migration is deferred to R8.

### 4.6 Guidance additions by tool

| Tool | R6 addition |
|---|---|
| `tech_lead_progress_decide` | Ordered `nextActions`, each blocker’s ID, `doneWhen`, and `resumeWhen` |
| `tech_lead_critical_path` | `readyNow`, `nextWave`, `blockedBy`, and `scheduleSemantics: "topological-readiness-not-duration-criticality"` |
| `tech_lead_gate_plan` | `closurePlan.passWhen` and required evidence/report predicates |
| `tech_lead_gate_aggregate` | Missing role, conditional report, reject, invalid report, and quorum actions with exact retry conditions |
| `tech_lead_evidence_freshness` | Refresh actions tied to evidence ID/fingerprint plus a supplied or explicitly absent reference time |
| `tech_lead_assumption_register` | Verification action for every missing method or expiry condition |
| `tech_lead_change_impact` | `triggeredBy`, gate-specific reopen reasons, and follow-up verification actions |
| `tech_lead_transition_check` | Read-only `requiredStateChanges` checklist, including what makes a pivot/scope-down/stop defensible |

### 4.7 Starter loop

R6 documentation and capability metadata define a supported first-run loop:

1. `tech_lead_classify`
2. `tech_lead_context_validate`
3. `tech_lead_evidence_lint`
4. `tech_lead_progress_decide`

Each step documents:

- minimum input;
- which fields from the prior step are relevant;
- meaning of a successful analysis;
- next tool selection;
- how to interpret `CONTINUE`, `PAUSE`, `SCOPE-DOWN`, `PIVOT`, and `STOP`.

The loop does not require persistent storage. The user keeps the inline snapshot and feeds it to the next tool.

### 4.8 R6 acceptance criteria

1. A nested executable marker beyond the scan depth cannot return successful mutation preview.
2. Supplied non-array reports cannot pass gate precheck or aggregation.
3. Oversized or over-budget safety input returns a structured non-success result before unbounded traversal.
4. `PAUSE` is an `ok:true` lifecycle result when input is valid.
5. Every generated strict action has a reason code, a completion predicate, and a stable target ID when one exists.
6. Action ordering is stable for identical input.
7. Guidance does not create new I/O imports or side-effect paths.
8. One complete fixture passes through the starter loop without manual schema guessing.
9. Full legacy, core, composition, and artifact suites remain green.

## 5. R7: Guided Discovery and Optional Aggregation

### 5.1 Scope

R7 makes the 21-tool surface discoverable and optionally adds a narrow aggregating tool. It must not duplicate core validators or become a hidden agent loop.

### 5.2 Capability metadata v2

Capability records gain additive metadata:

```json
{
  "name": "tech_lead_gate_aggregate",
  "version": "1",
  "domain": "gates",
  "sideEffects": false,
  "inputMode": "json-string",
  "risk": "high",
  "recommendedWhen": ["gate review reports are available"],
  "requires": ["GatePlan", "reports"],
  "produces": ["GateVerdict", "Guidance"],
  "nextTools": ["tech_lead_gate_reopen", "tech_lead_progress_decide"],
  "recipe": "gate",
  "decisionMeaning": "A non-pass verdict blocks the gate; it does not mean the tool failed."
}
```

Metadata is descriptive and cannot alter the core computation.

### 5.3 Recipes

R7 publishes six recipes:

| Recipe | Entry point | Main tools | Completion condition |
|---|---|---|---|
| `starter` | New project snapshot | classify, context validate, evidence lint, progress decide | Valid lifecycle outcome plus next action queue |
| `resume` | Prior/current snapshots | resume card, resume reconcile, evidence freshness, progress decide | Current snapshot reconciled and next step explicit |
| `evidence` | Context snapshot | evidence lint, graph lint, freshness, assumption register | No blocking evidence gaps or explicit PAUSE |
| `gate` | Impact plus reports | change impact, gate plan, gate aggregate, gate reopen | Gate pass or closure plan |
| `release` | File inventory | release audit, evidence lint, gate tools | Findings complete and release decision explicit |
| `mutation-preview` | Mutation intent | mutation preview, change impact, gate plan | Preview complete or safely denied |

Recipes are documentation and metadata first. They do not persist intermediate results or perform calls on the caller’s behalf.

### 5.4 Optional `tech_lead_guidance`

Only after R6 has evidence that action queues are useful may R7 add `tech_lead_guidance`.

Input: one valid ContextSnapshot plus optional named outputs from existing Themis tools.

Output: merged, deduplicated strict action queue and optional heuristics.

Constraints:

1. It may consume known result shapes but must not reimplement lint, impact, gate, or freshness logic.
2. It may only sort, deduplicate, explain, and surface conflicts between supplied results.
3. A conflict is reported as `GUIDANCE_CONFLICT`; it must not be silently resolved by heuristic mode.
4. It cannot make a Gate pass, clear a finding, or manufacture evidence.
5. It returns `ok:false` when a referenced supplied result has incompatible schema/version.

R7 should not add this tool if capability metadata and recipes adequately solve tool discovery. The implementation decision should be backed by adoption metrics, not preference.

## 6. R8: Canonical Context and Contract Migration

### 6.1 Scope

R8 addresses the structural split between the prose skill’s `state.json` and `tech-lead.context.v1`, plus the legacy bare-result contract. It is intentionally deferred because it changes interoperability rather than correcting safety.

### 6.2 Canonical format

Introduce `tech-lead.context.v2` as the canonical machine interchange format. It uses camelCase only and has explicit schema/version policy.

Required projection mapping:

| Existing state.json v1 | Context v2 |
|---|---|
| `goal_ledger` | `goalLedger` |
| `non_goals` | `nonGoals` |
| `open_gates` | `gates` |
| `next_step` | `current.nextStep` |
| `last_outcome` | `current.lastOutcome` |
| `repository_mode` | `project.repositoryMode` |
| `updated_at` | `snapshot.at` |
| `evidence` | `evidence` |
| `assumptions` | `assumptions` |

New pure functions:

- `projectStateToContextV2(state, projectionOptions)`;
- `contextV2ToProjectState(context, projectionOptions)`;
- `normalizeContextVersion(raw, compatibilityMode)`.

These functions return transformed data plus warnings and loss reports. They never write `state.json`.

### 6.3 Version policy

Every versioned payload identifies:

- schema ID;
- accepted versions;
- normalized output version;
- compatibility mode (`strict` or `compat`);
- deprecated fields seen;
- conversion loss, if any.

Unsupported versions return `UNSUPPORTED_SCHEMA_VERSION`, not a generic invalid-schema message.

Compatibility policy:

1. Exact current version is accepted in strict and compat mode.
2. Known previous versions are accepted only in compat mode and normalized with warnings.
3. Unknown future versions are rejected in both modes unless an explicitly safe extension policy exists.
4. Unknown fields may be preserved as extensions only when they do not alter a safety decision.

### 6.4 Result migration

R8 establishes `tech-lead.result.v2` for every public tool, including legacy tools. It provides:

- `ok`, `code`, `data`, `findings`, `warnings`, `guidance`, and `meta`;
- `meta.outputProtocol` and `meta.complete`;
- deterministic/reference-time metadata;
- an optional legacy projection for compatibility.

Legacy tool names stay stable through at least one minor release cycle. Their default output may remain bare only behind a declared compatibility setting; new integrations consume envelopes.

## 7. Error, Completeness, and Determinism Contract

### 7.1 Common codes

| Code | Meaning | `ok` |
|---|---|---:|
| `OK` | Valid analysis completed | true |
| `BAD_INPUT` | Wrong type, invalid JSON, or required field missing | false |
| `BAD_REPORTS` | Reports container was supplied in invalid shape | false |
| `SCHEMA_INVALID` | Known schema ID but invalid structure | false |
| `UNSUPPORTED_SCHEMA_VERSION` | Unknown or forbidden version | false |
| `INPUT_TOO_LARGE` | Byte budget exceeded before parsing | false |
| `ITEM_LIMIT_EXCEEDED` | Structural item/key/node budget exceeded | false |
| `SCAN_INCOMPLETE` | A safety-relevant scan stopped before a complete decision | false |
| `CAPABILITY_DENIED` | Requested operation conflicts with read-only policy | false |
| `INTERNAL` | Unexpected failure without stack/path disclosure | false |

Expected governance results such as gate `conditional`, gate `reject`, and lifecycle `PAUSE` are data outcomes under `OK` when their inputs were valid.

### 7.2 Completeness

Every result that may truncate has:

```json
{
  "meta": {
    "complete": false,
    "truncation": {
      "kind": "findings",
      "returned": 500,
      "observed": 731,
      "limit": 500
    }
  }
}
```

For safety and release decisions, a truncated result must not say the scan passed. Either return a blocked/non-success result or explicitly state that it is a partial non-authoritative preview.

### 7.3 Reference time

Freshness-sensitive operations accept `referenceTime` in ISO-8601 UTC.

- Strict mode requires valid `referenceTime`; otherwise result is `BAD_INPUT` or explicitly `deterministic:false` according to the tool’s documented compatibility mode.
- Heuristic mode may use current time only if it sets `meta.deterministic:false`, `meta.clockSource:"runtime"`, and returns the observed timestamp.
- Existing `resumeCard` behavior is migrated in R8; R6 should document its nondeterministic legacy behavior and add pinned-time support where possible.

## 8. Testing Strategy

### 8.1 R6 tests

| Area | Required examples |
|---|---|
| Mutation scan | Case variants, nested markers below/at/above depth boundary, node exhaustion, byte exhaustion, marker-free preview |
| Gate reports | Omitted reports, supplied string/object reports, malformed element, duplicate role, over-budget array |
| Resource limits | Oversized JSON before parse, huge arrays, huge graph, over-depth object, rendered output truncation |
| Guidance | Stable ordering, target ID traceability, all actions have `doneWhen`, no actions with ungrounded reason codes |
| Lifecycle semantics | Valid `CONTINUE`, `PAUSE`, `PIVOT`, `STOP` are `ok:true`; malformed inputs remain `ok:false` |
| Release scan | Path/token/credential findings independently emitted from a single line |
| Starter loop | One fixture passes through all four tools and documented handoffs |

### 8.2 Properties

Property-style checks are preferred for boundary code:

1. Increasing irrelevant input cannot alter strict action order for existing blockers.
2. Every strict action references a reason visible in the result.
3. No budget-exhausted safety input produces `ok:true`.
4. Reordering independent input records does not alter canonical strict action order.
5. Pinned `referenceTime` makes freshness-sensitive output byte-for-byte deterministic.
6. Heuristic mode cannot alter strict pass, verdict, allowed, required roles, or minimum evidence.

### 8.3 Artifact testing

All new behavior must be covered in both source-level tests and `tests/artifact-smoke.test.js` or a successor artifact suite. The npm tarball is the shipped product; workspace-only coverage is insufficient.

## 9. Adoption and Measurement

Before R7 aggregation or R8 migration, collect non-sensitive operational measurements from test fixtures, manual trials, or approved telemetry:

| Measure | Why it matters |
|---|---|
| Time from install to first valid tool call | Tests first-run clarity |
| Invalid-input rate by tool | Identifies schema/tool discovery friction |
| Calls required to reach a lifecycle decision | Tests starter-loop efficiency |
| Output reuse success rate | Tests handoff and schema burden |
| Abandonment after capability discovery | Detects 21-tool overload |
| Resume conversion success rate | Determines whether R8 projection is justified |
| Guidance action completion/retry rate | Tests whether `doneWhen` is actionable |

No telemetry is required for R6. If telemetry is introduced later, it must be opt-in, scrubbed of project content and secrets, and outside the plugin’s current no-network boundary.

## 10. Implementation Sequence and Release Gates

### R6 order

1. Define shared budgets and common result semantics in protocol/core boundary.
2. Fix mutation and gate fail-open behavior with regression tests.
3. Add strict guidance builders to progress, gates, evidence, impact, transition, and critical-path modules.
4. Add heuristic append-only guidance behind explicit option.
5. Update tool adapters without breaking existing fields.
6. Add starter recipe/docs and end-to-end fixture.
7. Rebuild artifact, run source/composition/artifact tests, inspect tarball, and publish a minor version.

### R7 admission gate

Do not add `tech_lead_guidance` until all are true:

- R6 starter loop is documented and tested.
- Strict action queue is proven stable and traceable.
- At least three observed workflows show repeated manual merging of tool outputs.
- Capability metadata recipes do not sufficiently solve discovery.

### R8 admission gate

Do not create Context v2 until all are true:

- Existing state/context mapping is documented with at least five real representative fixtures.
- Conversion loss behavior is specified.
- Legacy output usage is inventoried.
- A compat-mode migration can be tested against a released v1 artifact.

## 11. Non-Goals and Rejected Directions

| Rejected direction | Reason |
|---|---|
| Automatic state writes | Violates read-only plugin boundary and creates recovery/authorization obligations |
| Automatically invoking next tools | Conceals input shaping and can become an uncontrolled agent loop |
| Shell/network verification from plugin | Violates the security model; callers can perform approved verification externally |
| Heuristics deciding Gate pass/fail | Turns advice into ungrounded governance authority |
| Replacing all 21 tools with one opaque super-tool | Removes auditability and repeats core logic inside an orchestrator |
| Immediate Context v2 migration | Higher compatibility risk than the R6 safety/guidance value justifies |
| Silent truncation for release/safety scans | Partial output cannot be treated as a complete audit |

## 12. File-Level Implementation Map

This map is a handoff boundary, not implementation authorization.

| File or area | R6 responsibility |
|---|---|
| `src/protocol.js` | Input budgets, parse diagnostics, completeness metadata, common result helpers |
| `src/core/envelope.js` | `OK` semantics, deterministic/reference-time metadata, completeness fields |
| `src/core/mutation.js` | Fail-closed bounded marker scan |
| `src/core/gate.js` and `src/core/gates.js` | Malformed report handling, closure plan, strict actions |
| `src/core/progress.js` | Ordered blocker/action planning |
| `src/core/critical-path.js` | Readiness waves and explicit topology semantics |
| `src/core/evidence*.js` | Refresh and verification actions tied to IDs/fingerprints |
| `src/core/impact.js`, `src/core/transition.js` | Trigger provenance and transition completion checklist |
| `src/core/capabilities.js` | R7 metadata only; no R6 super-tool |
| `src/tools/*.js`, `src/tools.js` | Additive schema/options wiring and lifecycle result compatibility |
| `README.md`, `README.zh-CN.md`, package README | Starter loop, decision meanings, install/version truth |
| `tests/`, package tests, artifact smoke | Boundary, property, end-to-end, and shipped-artifact coverage |

## 13. Definition of Done

The architecture is ready for implementation when a reviewer can answer yes to each question:

1. Does the design preserve Themis as a read-only advisory system?
2. Can a safety-relevant incomplete scan ever report success? It must answer no.
3. Can a caller distinguish bad input from a valid `PAUSE` decision? It must answer yes.
4. Does every strict guidance action have a provenance, completion predicate, and bounded follow-up? It must answer yes.
5. Can heuristic mode alter a strict gate decision? It must answer no.
6. Is R6 independently valuable without R7/R8? It must answer yes.
7. Are R7 and R8 guarded by observed need rather than speculative architecture? It must answer yes.
8. Can the released npm artifact, rather than only workspace source, prove these properties? It must answer yes.
