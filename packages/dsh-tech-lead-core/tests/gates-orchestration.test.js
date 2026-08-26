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

test('gate functions tolerate invalid runtime shapes without throwing', () => {
  assert.doesNotThrow(() => gatePlan(null, null));
  assert.doesNotThrow(() => gateAggregate(null, null));
  assert.doesNotThrow(() => gateReopen(null, null));
});

test('gate aggregation requires distinct passing reviewers for every required role', () => {
  const result = gateAggregate([
    { role: 'eng', verdict: 'pass', anchors: ['a'] },
    { role: 'eng', verdict: 'pass', anchors: ['b'] },
  ], { requiredRoles: ['eng'], quorum: 2 });
  assert.equal(result.pass, false);
  assert.equal(result.verdict, 'conditional');
  assert.ok(result.findings.some((item) => item.code === 'DUPLICATE_ROLE'));
});

test('gate aggregation rejects invalid report verdicts', () => {
  const result = gateAggregate([
    { role: 'eng', verdict: 'wat', anchors: ['a'] },
  ], { requiredRoles: ['eng'], quorum: 1 });
  assert.equal(result.pass, false);
  assert.ok(result.findings.some((item) => item.code === 'INVALID_VERDICT'));
});

test('duplicate-role reject still propagates verdict and findings', () => {
  const result = gateAggregate([
    { role: 'eng', verdict: 'pass', anchors: ['a'] },
    { role: 'eng', verdict: 'reject', anchors: ['b'], findings: [{ id: 'r1', message: 'x' }] },
  ], { requiredRoles: ['eng'], quorum: 1 });
  assert.equal(result.pass, false);
  assert.equal(result.verdict, 'reject');
  assert.ok(result.findings.some((item) => item.id === 'r1'));
  assert.ok(result.findings.some((item) => item.code === 'DUPLICATE_ROLE'));
});

test('non-string anchor items invalidate the report instead of counting toward quorum', () => {
  const result = gateAggregate([
    { role: 'eng', verdict: 'pass', anchors: [123, null] },
  ], { requiredRoles: ['eng'], quorum: 1 });
  assert.equal(result.pass, false);
  assert.ok(result.findings.some((f) => f.code === 'INVALID_REPORT' && f.path === '/reports/0/anchors'));
});

test('invalid plan marks the aggregation unresolved even when roles are filled', () => {
  const result = gateAggregate([
    { role: 'eng', verdict: 'pass', anchors: ['a'] },
  ], { requiredRoles: ['eng'], quorum: 5 });
  assert.equal(result.pass, false);
  assert.equal(result.verdict, 'conditional');
  assert.equal(result.unresolved, true);
});

test('empty anchors array never satisfies the anchored-review guarantee', () => {
  const r = gateAggregate([{ role: 'eng', verdict: 'pass', anchors: [] }], { requiredRoles: ['eng'], quorum: 1 });
  assert.equal(r.pass, false);
  assert.ok(r.findings.some((f) => f.code === 'INVALID_REPORT'));
});

test('dependency and impact fingerprint drift each trigger reopen accounting', () => {
  assert.deepEqual(gateReopen({ dependencyFingerprint: 'a' }, { dependencyFingerprint: 'b' }).changedInputs, ['dependencies']);
  assert.deepEqual(gateReopen({ impactFingerprint: 'a' }, { impactFingerprint: 'b' }).changedInputs, ['impact']);
});
