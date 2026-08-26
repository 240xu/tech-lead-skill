# R8 Projection Loss Boundary — reverse conversion DEFERRED

Date: 2026-08-26 · Plan: docs/superpowers/plans/2026-08-26-dsh-themis-r8-implementation.md Task 6

## Forward map recap

`projectStateToContextV2` requires four non-inventable options (`projectId`, `projectName`, `snapshotSource`, `snapshotFingerprint`) plus `at`; unrecognized v1 keys migrate into namespaced `extensions`; `updated_at` is dropped in favor of caller-supplied `snapshot.at`.

## Why reverse is not lossless today

| Lost dimension | Reason |
|---|---|
| `project.id/name`, `snapshot.source/fingerprint/at` | supplied by caller options, absent from v2→v1 target shape |
| unknown-extension fidelity | namespaced `extensions["migrated:*"]` cannot be reliably split back into original top-level v1 keys |
| `gates` object vs arrays | v1 `gates` object has no direct v2 home; round-trip would need a reserved field |

A mechanical rename-back would fabricate identity data — exactly what §14.7 forbids.

## Decision

`contextV2ToProjectState` is **NOT implemented**. Recorded as `NON_LOSSLESS_PROJECTION`. Revisit only with an explicit loss-tolerant contract (e.g., caller re-supplies identity options) plus new fixtures proving equivalence for the subset that matters.
