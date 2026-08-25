# Technical Guide

[English](TECHNICAL_GUIDE.md) | [简体中文](https://github.com/240xu/tech-lead-skill/blob/main/docs/TECHNICAL_GUIDE.zh-CN.md)

## 1. Planning Model

The skill treats a project as a controlled loop rather than a static checklist.

### 1.1 Planning Objects

Every important statement should be typed:

| Object | Question |
|---|---|
| Goal | What user-visible result matters? |
| Metric | How will that result be measured? |
| Constraint | What must not be violated? |
| Fact | What has been observed and where? |
| Assumption | What is temporarily believed but unverified? |
| Decision | Which option was selected and why? |
| Risk | What could make the goal fail? |
| Dependency | What external state or prerequisite blocks progress? |
| Evidence | What observation supports or falsifies a claim? |

The minimum goal chain is:

```text
goal -> metric -> baseline -> target -> measurement -> deadline/stop -> non-goal
```

### 1.2 Plan Resolution

- L0 answers what the system or project is.
- L1 turns L0 into milestones with goals, DoD, gates, dependencies, triggers, and status.
- L2 expands only the current one or two milestones into the smallest executable actions.

The plan should be detailed near the current focus and deliberately coarse in the distance.

## 2. Iteration Cycle

Each meaningful round has five beats:

1. Display the full plan snapshot and `Delta vs previous round`.
2. Execute the smallest current action.
3. Observe hard evidence rather than inferred success.
4. Revise affected plan items and assumptions.
5. Ask whether the goal, evidence, blockers, and falsification strategy still hold.

The round ends with exactly one outcome:

- `CONTINUE`: the path remains supported and the next action has a testable result.
- `PAUSE`: a missing resource or external fact blocks safe progress.
- `SCOPE-DOWN`: preserve value by reducing scope and rewriting DoD and Non-Goals.
- `PIVOT`: a core assumption or decision was falsified.
- `STOP`: the goal is achieved, risk is unacceptable, or further work is not worth its cost.

## 3. Change Safety

Every state-changing action uses the mutation protocol:

```text
READ -> CLASSIFY -> PROTECT -> CHANGE -> VERIFY -> RECONCILE -> ROLLBACK/RECORD
```

The protocol is intentionally asset-aware. A source edit, a user database migration, a secret-file update, and a process restart are not equivalent changes and must not share the same default procedure.

Before changing a runtime or deployment target, compare the plan with current reality: file version or hash, service state, effective configuration, health endpoint, port state, database migration version, and deployed version.

## 4. Completion

Completion is layered:

1. `artifact-complete`: the intended artifact exists.
2. `functional-verified`: the behavior passes applicable functional checks.
3. `operational-verified`: the real process, deployment, or integration path works.
4. `outcome-validated`: the user goal or key metric is observed.

A stable plan is not enough. Two rounds with no plan delta are useful convergence evidence, but they cannot replace the completion level required by the project.

## 5. Review and Stagnation

Adversarial review is required when a gate is irreversible, affects several downstream milestones, or follows a disputed decision. Reviewers inspect the same artifact snapshot and must cite concrete evidence or counterexamples. Repeated wording does not count as independent findings.

The stagnation circuit breaker activates when there is no new E2+ evidence for two rounds, the critical path does not shrink, assumptions are reused without a validation design, or scope reduction is not re-baselined. The next action must be a falsifying experiment, pause, pivot, or stop.

## 6. State and Recovery

Git repositories use commits and tags for source/configuration lineage. Non-Git environments use a manifest describing paths, versions, backups, service state, and verification commands. `state.json` stores the compact machine-readable summary, while human-readable ledgers live in the project-state files.

On resume, reconcile saved state with the real environment. If they conflict, reality wins and the affected plan items become `[待重估]`.

## 7. Future Toolization

Core judgment stays prose-first; a mechanical subset is machine-checkable: `bin/install.js --check|--dry-run` for install drift, and the optional DSH bundle (`packages/`) exposing 21 composable read-only tools. The original nine audit tools remain compatible; the strengthened surface adds context, evidence graph/freshness, progress, critical path, impact, resume reconciliation, gate orchestration, and mutation preview.

## 8. Release Readiness

When publishing a skill or technical document, do not publish the mixed working directory. Build a clean staging directory from an explicit allowlist, then run:

```text
allowlist -> content scan -> reference check -> scope check
          -> publication check -> publish -> remote verify
```

The content scan covers local paths, personal data, credentials, cookies, tokens, internal hosts, deployment details, private repository links, and real test data. The reference check covers versions, section numbers, repository-relative paths, template references, placeholders, and the README entry point. The scope check removes project-specific operational details and retains only mechanisms that can be reused elsewhere.

After publication, independently check the remote visibility, default branch, commit, file inventory, and README access. A local commit is not evidence that a remote publication succeeded. If repository creation or push fails, stop the dependent verification steps and report the actual remote state.

The release check must record limitations. A clean scan is evidence that the defined checks passed, not proof that unknown sensitive information does not exist.

## 9. Runtime Discipline

Projects that produce long-running services, scheduled jobs, batch pipelines, or third-party dependencies add five rules:

1. **External dependency health**: register probes for critical upstreams. Placeholder data (such as all-`127.0.0.1` nodes), dead domains, and upstream end-of-life mean the dependency is dead — take the alternative path instead of retrying as a transient error.
2. **Silent failure class**: HTTP 200 with an empty body or early EOF, placeholder content, and silent truncation are failure classes distinct from explicit errors; verify content validity rather than status codes, and count repeated silent failures in the re-planning tally.
3. **Automation trio**: long-running loops carry a hard timeout, a consecutive-failure circuit breaker, and a concurrency cap. Recovery is staged as bounded retry, isolate a connection or instance, controlled restart, then controlled rebuild; rebuilding needs idempotency, a recovery point, rate limits, a maximum count, and a human escalation condition. Systems that live across days add scheduled health checks, and the monitor itself needs a liveness check.
4. **Batch idempotency**: batch tasks are re-runnable with dry-run preview and incremental reconciliation; repeated runs never duplicate data.
5. **Fallback ladder**: degradation chains are designed up front with per-level triggers; improvised fallbacks during incidents are treated as directional defects and re-planned.

## 10. State and Review Artifacts

The bundled templates are records, not decorative checklists:

- `state.json` is the canonical resumable projection. If the project is read-only, record `state_persistence: unavailable` elsewhere instead of creating files.
- `intake.md` establishes the goal chain and typed planning ledgers.
- `plan.md` carries L0/L1/L2 lineage, milestone gates, completion levels, and evidence anchors.
- `round.md` records delta counts, failure classification, rework level, stagnation checks, and outcome details.
- `change-record.md` proves each step of the mutation protocol and records requirement changes separately from implementation changes.
- `gate-review.md` and `gate-verdict.md` record independent review, anchored findings, and adopted or rejected decisions.
- `release-check.md` records the seven release phases and stops publication when a prerequisite or remote verification is unresolved.

Use the smallest applicable artifact set, but do not omit a required record merely because the work is inconvenient to document. A template entry without an evidence anchor is an open item, not proof of completion.
