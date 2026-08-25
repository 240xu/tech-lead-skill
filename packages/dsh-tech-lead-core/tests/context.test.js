import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContext, normalizeContext } from '../src/context.js';

const valid = () => ({
  schema: 'tech-lead.context.v1',
  project: { id: 'p1', name: 'demo', repositoryMode: 'git' },
  goalLedger: [{ id: 'g1', goal: 'ship', metric: 'tests', target: 'green' }],
  nonGoals: [], constraints: [], assets: [], assumptions: [], decisions: [],
  risks: [], dependencies: [], evidence: [], gates: [],
  current: { mode: 'PLAN', tier: 'T1', phase: 'M0', lastOutcome: '', nextStep: 'test' },
  snapshot: { at: '2026-08-25T00:00:00Z', source: 'inline', fingerprint: 'abc' },
});

test('valid context snapshot passes', () => {
  const result = validateContext(valid());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('context reports missing goals and invalid current enums', () => {
  const input = valid();
  input.goalLedger = [];
  input.current.mode = 'RUN';
  input.snapshot.source = 'filesystem';
  const result = validateContext(input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.path === '/goalLedger'));
  assert.ok(result.errors.some((item) => item.path === '/current/mode'));
  assert.ok(result.errors.some((item) => item.path === '/snapshot/source'));
});

test('normalization does not mutate input and warns on unknown fields', () => {
  const input = valid();
  input.extra = true;
  const normalized = normalizeContext(input);
  assert.notEqual(normalized.value, input);
  assert.equal(input.extra, true);
  assert.ok(normalized.warnings.some((item) => item.path === '/extra'));
});

test('non-object context returns structured invalid result', () => {
  assert.equal(validateContext(null).valid, false);
  assert.equal(validateContext('x').errors[0].path, '/');
});
