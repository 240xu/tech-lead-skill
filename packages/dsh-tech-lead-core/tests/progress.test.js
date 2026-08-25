import test from 'node:test';
import assert from 'node:assert/strict';
import { progressDecide } from '../src/progress.js';

const base = (overrides = {}) => ({
  goalLedger: [{ id: 'g1', status: 'open' }],
  risks: [], dependencies: [], evidence: [{ id: 'e1', level: 'E3' }],
  gates: [], current: { lastOutcome: '' }, ...overrides,
});

test('progress continues when no blocker exists', () => {
  const result = progressDecide(base());
  assert.equal(result.outcome, 'CONTINUE');
  assert.equal(result.allowed, true);
});

test('blocked dependency forces pause', () => {
  const result = progressDecide(base({ dependencies: [{ id: 'd1', blocker: true, status: 'open' }] }));
  assert.equal(result.outcome, 'PAUSE');
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('d1'));
});

test('stale evidence forces pause before continue', () => {
  const result = progressDecide(base({ evidence: [{ id: 'e1', stale: true }] }));
  assert.equal(result.outcome, 'PAUSE');
  assert.ok(result.reasons.some((item) => item.code === 'STALE_EVIDENCE'));
});

test('invalid context input does not throw', () => {
  assert.equal(progressDecide(null).outcome, 'PAUSE');
});

test('invalid options input does not throw', () => {
  assert.doesNotThrow(() => progressDecide({ dependencies: [], evidence: [], gates: [] }, null));
});
