# dsh-themis

Themis — tech-lead lifecycle governance for DeepSeek Harness: **21 governance tools + discovery**
(task tiering, state/plan/evidence validation, gate precheck/aggregation/reopen,
release/install audits, context & progress analysis, critical path,
resume reconciliation, mutation preview that always denies execution).

`dsh plugin --profile headless add dsh-themis`

No filesystem writes, no subprocesses, no network access — every tool computes
over caller-supplied JSON only. Inputs are budget-bounded (oversized or
unscannable payloads fail closed with INPUT_TOO_LARGE / SCAN_INCOMPLETE), and
decision tools attach deterministic guidance (nextActions with doneWhen).
Every tool accepts `protocolJson` to negotiate the result wire format
(bare legacy / tech-lead.result.v1 envelope / tech-lead.result.v2 default), and
canonical context snapshots (tech-lead.context v2) validate strictly or migrate
unknown keys into namespaced extensions under compat mode.
Upstream docs: https://github.com/240xu/verdict-engine
