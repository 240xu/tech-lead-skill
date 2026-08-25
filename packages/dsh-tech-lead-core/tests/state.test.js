import test from 'node:test';
import assert from 'node:assert/strict';
import { validateState } from '../src/state.js';

const valid = {
  schema_version: 1,
  mode: 'EXECUTE',
  tier: 'T2',
  phase: 'M1',
  repository_mode: 'git',
  state_persistence: 'available',
  done: [{ item: '骨架可运行', anchor: 'commit:abc1234' }],
  open_gates: [],
  goal_ledger: [],
  constraints: [],
  decisions: [],
  risks: [],
  dependencies: [],
  evidence: [{
    id: 'E-1', level: 'E2', source: 'node --test',
    time: '2026-08-25T00:00:00Z', scope: 'installer tests', repro: 'node --test tests/',
  }],
  critical_path: [],
  protected_assets: [],
  hypotheses: [],
  assumptions: [],
  last_outcome: 'CONTINUE',
  next_review_trigger: '',
  degraded_reason: '',
  tags: [],
  next_step: 'run phase B',
  updated_at: '2026-08-25T01:02:03Z',
};

test('valid state passes with no errors and no unknown fields', () => {
  const r = validateState(valid);
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.unknownFields, []);
});

test('string schema_version "1" stays compatible', () => {
  const r = validateState({ ...valid, schema_version: '1' });
  assert.equal(r.valid, true);
});

test('enum violations reported per path', () => {
  const r = validateState({ ...valid, mode: 'THINKING', tier: 'T9', last_outcome: 'MAYBE' });
  assert.equal(r.valid, false);
  const paths = r.errors.map((e) => e.path);
  assert.ok(paths.includes('mode'));
  assert.ok(paths.includes('tier'));
  assert.ok(paths.includes('last_outcome'));
});

test('done entries require non-empty anchor', () => {
  const r = validateState({
    ...valid,
    done: [{ item: 'x', anchor: '' }, { item: 'y' }],
  });
  assert.equal(r.valid, false);
  const paths = r.errors.map((e) => e.path).join('|');
  assert.match(paths, /done\[0\]\.anchor/);
  assert.match(paths, /done\[1\]\.anchor/);
});

test('evidence entries require full provenance and bounded level', () => {
  const r = validateState({
    ...valid,
    evidence: [
      { id: 'A', level: 'E9', source: 's', time: 't', scope: 'sc' }, // missing repro + bad level
      { id: 'B', level: 'E2', source: 's', time: 't', scope: 'sc', repro: 'r' },
    ],
  });
  assert.equal(r.valid, false);
  const paths = r.errors.map((e) => e.path).join('|');
  assert.match(paths, /evidence\[0\]\.repro/);
  assert.match(paths, /evidence\[0\]\.level/);
  assert.ok(!paths.includes('evidence[1]'));
});

test('unknown fields are preserved as warnings, not errors', () => {
  const r = validateState({ ...valid, future_field: 123 });
  assert.equal(r.valid, true);
  assert.deepEqual(r.unknownFields, ['future_field']);
  assert.ok(r.warnings.some((w) => w.path === 'future_field'));
});

test('missing updated_at or empty next_step fails; non-object input fails cleanly', () => {
  assert.equal(validateState({ ...valid, updated_at: '' }).valid, false);
  assert.equal(validateState(null).valid, false);
  assert.equal(validateState('nope').valid, false);
});
