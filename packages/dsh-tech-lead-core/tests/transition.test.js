import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionCheck } from '../src/transition.js';

const base = { decisions: [], goal_ledger: [], risks: [], done: [], degraded_reason: '' };

test('CONTINUE always allowed; bad enum rejected', () => {
  assert.equal(transitionCheck(base, 'CONTINUE').allowed, true);
  assert.equal(transitionCheck(base, 'MAYBE').allowed, false);
});

test('PIVOT needs a falsified decision on record', () => {
  assert.equal(transitionCheck(base, 'PIVOT').allowed, false);
  assert.equal(
    transitionCheck({ ...base, decisions: [{ choice: 'A' }] }, 'PIVOT').allowed,
    true
  );
});

test('SCOPE-DOWN needs ledger+risks; STOP needs done or degraded_reason', () => {
  assert.equal(transitionCheck(base, 'SCOPE-DOWN').allowed, false);
  assert.equal(
    transitionCheck({ ...base, goal_ledger: [{}], risks: [{}] }, 'SCOPE-DOWN').allowed,
    true
  );
  assert.equal(transitionCheck(base, 'STOP').allowed, false);
  assert.equal(transitionCheck({ ...base, degraded_reason: 'quota exhausted' }, 'STOP').allowed, true);
});
