import test from 'node:test';
import assert from 'node:assert/strict';
import { gatePrecheck } from '../src/gate.js';

const report = (id, verdict = 'pass') => ({
  reviewerId: id,
  verdict,
  anchors: ['src/x.js:12'],
});

test('clean three-reviewer gate passes', () => {
  const r = gatePrecheck({
    proposalAuthorId: 'main',
    executorId: 'worker-1',
    reviewerIds: ['pm', 'arch', 'eng'],
    reports: [report('pm'), report('arch'), report('eng')],
  });
  assert.equal(r.pass, true);
  assert.deepEqual(r.violations, []);
});

test('identity separation violations detected', () => {
  const r = gatePrecheck({
    proposalAuthorId: 'main',
    executorId: 'worker-1',
    reviewerIds: ['pm', 'main'],
    reports: [report('pm'), report('main')],
  });
  assert.equal(r.pass, false);
  assert.ok(r.violations.some((v) => v.type === 'IDENTITY_OVERLAP'));
});

test('reports without anchors are rejected; bad verdict rejected', () => {
  const r = gatePrecheck({
    reviewerIds: ['a', 'b'],
    reports: [
      { reviewerId: 'a', verdict: 'pass', anchors: [] },
      { reviewerId: 'b', verdict: 'maybe' },
    ],
  });
  assert.equal(r.pass, false);
  const types = r.violations.map((v) => v.type).join(',');
  assert.match(types, /ANCHOR_MISSING/);
  assert.match(types, /BAD_VERDICT/);
});

test('solo review forbidden for destructive scope', () => {
  const r = gatePrecheck({ solo: true, destructiveScope: ['prod-db'], reviewerIds: [] });
  assert.equal(r.pass, false);
});

test('blind gate requires >=3 distinct anchored reviewers', () => {
  const two = gatePrecheck({
    blindRequired: true,
    reviewerIds: ['a', 'b'],
    reports: [report('a'), report('b')],
  });
  assert.equal(two.pass, false);
  const three = gatePrecheck({
    blindRequired: true,
    reviewerIds: ['a', 'b', 'c'],
    reports: [report('a'), report('b'), report('c')],
  });
  assert.equal(three.pass, true);
});

test('non-array destructiveScope is a structured violation, never a throw', () => {
  const r = gatePrecheck({ solo: true, destructiveScope: 'rm -rf /', reviewerIds: [] });
  assert.equal(r.pass, false);
  assert.ok(r.violations.some((v) => v.type === 'BAD_DESTRUCTIVE_SCOPE'));
});
