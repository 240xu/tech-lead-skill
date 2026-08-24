# Technical Guide

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

The skill deliberately remains prose-first. After at least three real projects, record repeated violations and near misses. Tool candidates should be chosen using both severity and frequency: a rare catastrophic invariant is not ignored merely because it is rare, while common low-risk checks are good efficiency candidates.

## 8. Release Readiness

When publishing a skill or technical document, do not publish the mixed working directory. Build a clean staging directory from an explicit allowlist, then run:

```text
allowlist -> content scan -> reference check -> scope check
          -> publication check -> publish -> remote verify
```

The content scan covers local paths, personal data, credentials, cookies, tokens, internal hosts, deployment details, private repository links, and real test data. The reference check covers versions, section numbers, repository-relative paths, template references, placeholders, and the README entry point. The scope check removes project-specific operational details and retains only mechanisms that can be reused elsewhere.

After publication, independently check the remote visibility, default branch, commit, file inventory, and README access. A local commit is not evidence that a remote publication succeeded. If repository creation or push fails, stop the dependent verification steps and report the actual remote state.

The release check must record limitations. A clean scan is evidence that the defined checks passed, not proof that unknown sensitive information does not exist.
