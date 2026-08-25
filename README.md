# Tech Lead Skill

English | [简体中文](README.zh-CN.md)

An evidence-driven planning and delivery skill for software, infrastructure, research, reverse-engineering, and operations work.

## What It Solves

Many plans fail in one of two ways: they are vague and cannot guide execution, or they are over-detailed and become false after the first environmental change. This skill keeps the plan coarse until evidence justifies detail, then continuously revises it against observed reality.

The control loop is:

```text
goal -> constraints/assumptions -> L0/L1/L2 plan -> execute -> observe evidence
     -> revise -> choose CONTINUE / PAUSE / SCOPE-DOWN / PIVOT / STOP
```

## Core Features

- PLAN and EXECUTE modes with a clear boundary between planning and side effects.
- Progressive disclosure: L0 architecture, L1 milestones, L2 executable focus.
- Goal, metric, fact, assumption, decision, risk, dependency, and evidence ledgers.
- Protected asset handling for source, user data, configuration, secrets, runtime state, and generated artifacts.
- Minimal mutation protocol: `READ -> CLASSIFY -> PROTECT -> CHANGE -> VERIFY -> RECONCILE -> ROLLBACK/RECORD`.
- Evidence levels E0-E4, from model inference to observed user outcomes.
- Failure re-planning, stagnation circuit breaker, rollback discipline, and real-state reconciliation.
- Optional adversarial review for high-impact or irreversible changes.
- Git-backed and non-Git project-state recovery.
- Release-readiness checks for public documentation and skill publishing.
- Runtime discipline rules for external dependency health, silent failure classes, automation guardrails, idempotent batch jobs, and fallback ladders.

## Install

### npm (GitHub-hosted, no registry account needed)

```bash
npm i -g github:240xu/tech-lead-skill
tech-lead-skill          # installs into ~/.config/opencode/skills/tech-lead
```

One-shot without a global install:

```bash
npx github:240xu/tech-lead-skill
```

The installer is idempotent: repeated runs back up existing files as `*.bak-<timestamp>` first. Use `--target <dir>` to choose another destination, `--check` to verify an installed copy against the package (hash + version drift), `--dry-run` to preview without writing, and `--uninstall` to remove. Uninstall removes only manifest-managed files — user files and `*.bak-*` backups are kept.

### DeepSeek Harness plugin (read-only tools)

The repository also ships an opt-in DSH bundle exposing nine read-only lifecycle tools (`tech_lead_classify`, `tech_lead_state_validate`, `tech_lead_transition_check`, `tech_lead_plan_lint`, `tech_lead_evidence_lint`, `tech_lead_gate_precheck`, `tech_lead_release_audit`, `tech_lead_install_audit`, `tech_lead_resume_card`). The tools compute over caller-supplied JSON only — no filesystem writes, no subprocesses, no network access.

```bash
dsh plugin --profile headless add /path/to/tech-lead-skill/packages/dsh-tech-lead-bundle
dsh --profile headless --dump-config   # verify the tech-lead-tools row is present
```

See [`docs/superpowers/specs/2026-08-25-dsh-tech-lead-system.md`](https://github.com/240xu/tech-lead-skill/blob/main/docs/superpowers/specs/2026-08-25-dsh-tech-lead-system.md) for the architecture and permission matrix.

### Manual

Copy `skill/SKILL.md` and the `skill/templates/` directory into the skills directory of your OpenCode-compatible environment:

```text
~/.config/opencode/skills/tech-lead/
```

The skill is triggered by project construction, system building, implementation plans, deployment, migration, release, recovery, restructuring, operations work, and other substantial planning requests. It can also be loaded explicitly.

## Operating Modes

### PLAN

Use for intake, goal definition, architecture, decomposition, risk analysis, and verification design. PLAN does not edit files or run side-effecting commands.

### EXECUTE

Use after the L2 scope is clear. Execute only the smallest approved mutation, record the change, verify behavior, reconcile actual state, and update the plan.

## Protected Assets

| Class | Default handling |
|---|---|
| `SOURCE` | Inspectable diff, tests, and restore point |
| `USER_DATA` | Read-only by default; write only to an explicit target with recovery |
| `CONFIG` | Read current state, make the smallest change, reload, verify |
| `SECRET` | Never place in plans, logs, ordinary backups, or diffs |
| `RUNTIME` | Inspect live state before restart, kill, replace, or migration |
| `GENERATED` | Prefer regeneration; do not treat as the source of truth |

## Evidence Levels

- `E0`: model inference; hypothesis only.
- `E1`: static inspection, grep, or configuration inspection.
- `E2`: local command or unit test; local behavior only.
- `E3`: integration test, real process, or real endpoint.
- `E4`: user acceptance, real business result, or production observation.

## Templates

- `templates/intake.md`: goal, constraints, assets, risk, and completion level.
- `templates/plan.md`: L0/L1/L2 plan and current focus.
- `templates/change-record.md`: one EXECUTE mutation and its reconciliation.
- `templates/round.md`: one planning iteration and its outcome.
- `templates/state.json`: canonical resumable state projection.
- `templates/gate-review.md` and `templates/gate-verdict.md`: independent review and decision records.
- `templates/release-check.md`: publication inventory, scans, remote verification, and limitations.

## Scope

This is an engineering planning skill. It focuses on correctness of planning, safe handling of user files and code changes, evidence quality, rollback, and real-environment reconciliation. It intentionally stays focused on project-level engineering work rather than organization-wide process design.

## Limitations

- The judgment layer remains prose by design; a mechanical subset is machine-checkable via the optional DSH bundle (state/evidence/gate/release/install audits).
- Evidence freshness and state reconciliation are operator/agent responsibilities until dedicated tooling exists.
- The skill does not provide a sandbox; untrusted code must not be executed unless an actual isolated execution environment is already available.
- MCP candidates should be selected only after observing repeated real-project violations.

## Notes

The executable skill body (`SKILL.md`) is authored in Simplified Chinese; coding agents execute it correctly regardless of the conversation language. Templates are English and agent-facing. Documentation translations cover this README and the technical guide.

## Version

Current version: `v5.4.0`.

See [`docs/TECHNICAL_GUIDE.md`](docs/TECHNICAL_GUIDE.md) for the full operating model and [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md) for the publication audit.
