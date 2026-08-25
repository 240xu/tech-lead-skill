# Release Check

- Release ID:
- Release target:
- Version:
- Publication mode: `private` | `public`
- Clean staging directory:
- Release recovery point:

## Allowlist

- Intended files:
- Excluded files and directories:
- Final file inventory:

## Checks

- Sensitive-content scan: `PASS` | `FAIL` | `NOT-RUN`
- Local paths / personal data scan:
- Credentials / cookies / tokens scan:
- Internal hosts / deployment details scan:
- Reference and version check: `PASS` | `FAIL` | `NOT-RUN`
- Scope check: `PASS` | `FAIL` | `NOT-RUN`
- Documentation entry point check: `PASS` | `FAIL` | `NOT-RUN`
- Whitespace / parser check: `PASS` | `FAIL` | `NOT-RUN`

## Release State Machine

| Phase | Status | Evidence/command | Timestamp | Result | Blocking issue |
|---|---|---|---|---|---|
| INVENTORY | | | | | |
| CONTENT-SCAN | | | | | |
| REFERENCE-CHECK | | | | | |
| SCOPE-CHECK | | | | | |
| PUBLICATION-CHECK | | | | | |
| PUBLISH | | | | | |
| REMOTE-VERIFY | | | | | |

## Publication

- License present:
- Commit:
- Remote target:
- Remote creation/push result:
- Remote public/default-branch/file-list verification:
- Remote verification timestamp/freshness:
- Reconciliation result:
- Failure disposition: `STOP` | `PAUSE` | `NONE`

## Limits

- Unresolved limitations:
- Checks not performed:
- Next review trigger:
