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
