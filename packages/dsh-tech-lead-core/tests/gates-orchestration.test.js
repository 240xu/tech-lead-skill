import test from 'node:test';
import assert from 'node:assert/strict';
import { gatePlan, gateAggregate, gateReopen } from '../src/gates.js';

test('destructive high impact gate requires four roles and E3 evidence', () => {
  const result = gatePlan({ tier: 'T2', destructive: true, evidenceLevel: 'E3' }, {});
  assert.deepEqual(result.requiredRoles, ['pm', 'arch', 'eng', 'ops']);
  assert.equal(result.minimumEvidence, 'E3');
  assert.equal(result.quorum, 4);
});

test('gate aggregate propagates reject and de-duplicates anchored findings', () => {
  const result = gateAggregate([
    { role: 'pm', verdict: 'pass', anchors: ['a'], findings: [{ id: 'f1', message: 'x' }] },
    { role: 'arch', verdict: 'reject', anchors: ['b'], findings: [{ id: 'f1', message: 'x' }] },
  ], { requiredRoles: ['pm', 'arch'], quorum: 2 });
  assert.equal(result.pass, false);
  assert.equal(result.verdict, 'reject');
  assert.equal(result.findings.length, 1);
});

test('gate reopen detects snapshot and evidence drift', () => {
  const result = gateReopen(
    { contextFingerprint: 'old', evidenceFingerprint: 'old-e', verdict: 'pass' },
    { contextFingerprint: 'new', evidenceFingerprint: 'new-e' },
  );
  assert.equal(result.reopen, true);
  assert.deepEqual(result.changedInputs, ['context', 'evidence']);
});
