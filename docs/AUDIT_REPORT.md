# Publication Audit Report

Date: 2026-08-25
Scope: public release of the `tech-lead` planning skill and its eight templates.

## Result

The publication set contains only the following intended artifacts:

- `package.json` / `bin/install.js` (npm installer)
- `skill/SKILL.md`
- `skill/templates/intake.md`
- `skill/templates/plan.md`
- `skill/templates/change-record.md`
- `skill/templates/round.md`
- `skill/templates/release-check.md`
- `skill/templates/state.json`
- `skill/templates/gate-review.md`
- `skill/templates/gate-verdict.md`
- `README.md` (English) / `README.zh-CN.md` (简体中文)
- `docs/TECHNICAL_GUIDE.md` (English; Chinese README ships separately)
- `docs/AUDIT_REPORT.md`
- `LICENSE`

Documentation is bilingual (English + Simplified Chinese) by design; additional languages were intentionally excluded to limit maintenance surface. The skill body (`SKILL.md`) is authored in Simplified Chinese and is executed correctly by coding agents regardless of conversation language.

No unrelated home-directory files, project histories, server notes, credentials, or private operational documents are included.

## Checks Performed

### Sensitive-content scan

The source set was scanned for local absolute paths, passwords, API-key prefixes, SSH host details, private domains, and server IP patterns. The only address-like match is the explicitly documented loopback placeholder `127.0.0.1`; no real operational endpoint or credential was found in the publication set.

### Structural scan

- YAML frontmatter has `name: tech-lead` and a trigger description.
- The skill version is `v5.5.0`.
- The eight templates referenced by the skill exist.
- The installer validates options, requires a marker before removing any target, and records the managed package/version after installation.
- The release-check template covers allowlist inventory, sensitive-content scanning, reference checks, scope checks, publication results, and remote verification.
- The plan includes PLAN/EXECUTE, L0/L1/L2, protected assets, mutation protocol, E0-E4 evidence, completion levels, stagnation control, state recovery, and real-state reconciliation.
- Version markers verified against package.json at audit time (see CHANGELOG history for prior releases)

### Safety review

The skill defaults user data to read-only, requires a recovery path before writes, excludes secrets from normal plans/logs/diffs/backups, requires live-state inspection before runtime operations, and prevents untrusted code execution without an actual isolated environment.

## Known Limitations

- Core judgment stays prose-first; the source-checkout-only DSH workspace provides 21 machine-checkable read-only tools for context, evidence, progress, gates, release/install audits, recovery, and mutation preview. The root npm tarball intentionally excludes the private workspace packages. Since R6, legacy tools keep bare shapes except `tech_lead_gate_precheck` (envelope projection preserving `data.pass`/`data.violations`); strengthened tools return ResultEnvelope v1 where every governance-negative state is a valid `ok:true` analysis with closure guidance. Legacy audit arrays over the 500-finding window fail closed with `SCAN_INCOMPLETE` instead of being silently sliced (spec: docs/superpowers/specs/2026-08-26-dsh-themis-guidance-architecture.md).
- Freshness, reconciliation, and rollback verification depend on the executing environment.
- No claim is made that the skill has completed a multi-project effectiveness trial; that is the next validation phase.
- The audit validates publication content, not the security of the hosting platform or every consumer's local OpenCode installation.

## Release Decision

Publication is appropriate as a public documentation and skill repository. Consumers should review the skill before applying it to production or user-data changes, and should treat its templates as guidance until project-specific validation is complete.
