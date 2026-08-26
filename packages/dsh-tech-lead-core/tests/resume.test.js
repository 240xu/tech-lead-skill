import test from 'node:test';
import assert from 'node:assert/strict';
import { resumeCard } from '../src/resume.js';

const state = (over = {}) => ({
  tier: 'T2',
  phase: 'M1',
  mode: 'EXECUTE',
  last_outcome: 'CONTINUE',
  next_step: 'run composition test',
  open_gates: [],
  evidence: [],
  ...over,
});

test('card reflects position, outcome, next step', () => {
  const c = resumeCard(state());
  assert.match(c.position, /T2/);
  assert.match(c.position, /M1/);
  assert.equal(c.lastGate, 'CONTINUE');
  assert.equal(c.nextStep, 'run composition test');
});

test('empty next_step produces warning', () => {
  const c = resumeCard(state({ next_step: '' }));
  assert.ok(c.warnings.some((w) => w.includes('next_step')));
});

test('evidence older than maxAgeDays is stale', () => {
  const now = '2026-08-25T00:00:00Z';
  const c = resumeCard(state({
    evidence: [
      { id: 'OLD', level: 'E2', source: 's', time: '2026-07-01T00:00:00Z', scope: 'x', repro: 'r' },
      { id: 'NEW', level: 'E2', source: 's', time: '2026-08-24T00:00:00Z', scope: 'x', repro: 'r' },
    ],
  }), { now, maxAgeDays: 7 });
  assert.deepEqual(c.staleEvidenceIds, ['OLD']);
});

test('open gates surface as warnings', () => {
  const c = resumeCard(state({ open_gates: ['G3'] }));
  assert.ok(c.warnings.some((w) => w.includes('G3')));
});

test('null options object is tolerated and warning names opts.now', () => {
  assert.doesNotThrow(() => resumeCard({ tier: 'T0', phase: 'M0', mode: 'PLAN', evidence: [] }, null));
  const c = resumeCard({ tier: 'T0', phase: 'M0', mode: 'PLAN', evidence: [] }, { now: 'garbage' });
  assert.ok(c.warnings.some((w) => /opts\.now\b/.test(w)));
});

test('string maxAgeDays follows the strict-number policy with default semantics', () => {
  const state = { tier: 'T0', phase: 'M0', mode: 'PLAN', evidence: [{ id: 'e1', time: '2026-08-20T00:00:00Z' }] };
  const c = resumeCard(state, { now: '2026-08-25T00:00:00Z', maxAgeDays: '7' });
  assert.ok(c.warnings.some((w) => w.includes('maxAgeDays')));
  assert.deepEqual(c.staleEvidenceIds, []);
});

test('resumeCard honors the seven-day default when maxAgeDays omitted', () => {
  const base = { tier: 'T0', phase: 'M0', mode: 'PLAN' };
  const opts = { now: '2026-08-25T00:00:00Z' };
  assert.deepEqual(resumeCard({ ...base, evidence: [{ id: 'e', time: '2026-08-19T00:00:00Z' }] }, opts).staleEvidenceIds, []);
  assert.deepEqual(resumeCard({ ...base, evidence: [{ id: 'e', time: '2026-08-17T00:00:00Z' }] }, opts).staleEvidenceIds, ['e']);
});
