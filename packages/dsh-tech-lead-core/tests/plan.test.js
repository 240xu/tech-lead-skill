import test from 'node:test';
import assert from 'node:assert/strict';
import { planLint } from '../src/plan.js';

const completePlan = {
  goal: 'deliver X',
  metric: 'tests green',
  baseline: 'currently red',
  target: 'all pass',
  measure: 'node --test',
  assumptions: [{ claim: 'node>=16 present', verification: 'node --version' }],
  decisions: [{ choice: 'plain ESM', alternatives: ['TS build', 'CJS'], reason: 'zero toolchain' }],
  risks: [{ description: 'upstream API drift', impact: 'medium', mitigation: 'pin versions' }],
  dependencies: [{ what: 'pnpm on PATH', blocker: 'install pnpm first' }],
  rollback: 'git revert commit',
};

test('complete plan has no findings', () => {
  assert.deepEqual(planLint(completePlan), []);
});

test('goal ledger minimum enforced', () => {
  const f = planLint({ ...completePlan, metric: undefined, target: '' }).map((x) => x.path);
  assert.ok(f.includes('metric'));
  assert.ok(f.includes('target'));
});

test('assumptions need verification; decisions need alternatives+reason', () => {
  const p = {
    ...completePlan,
    assumptions: [{ claim: 'x' }],
    decisions: [{ choice: 'y' }],
  };
  const paths = planLint(p).map((x) => x.path);
  assert.match(paths.join('|'), /assumptions\[0\]\.verification/);
  assert.match(paths.join('|'), /decisions\[0\]\.alternatives/);
});

test('irreversible ops without rollback fail; dependencies need blockers', () => {
  const paths = planLint({
    ...completePlan,
    rollback: undefined,
    irreversibleOps: ['migrate-db'],
    dependencies: [{ what: 'db up' }],
  }).map((x) => x.path);
  assert.ok(paths.includes('rollback'));
  assert.match(paths.join('|'), /dependencies\[0\]\.blocker/);
});
