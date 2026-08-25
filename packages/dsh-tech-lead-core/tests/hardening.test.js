import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classify, resumeCard, gatePrecheck, releaseAudit, planLint,
} from '../src/index.js';

test('classify(null) and classify("x") do not throw', () => {
  for (const bad of [null, 'x', 42]) {
    const r = classify(bad);
    assert.equal(r.tier, 'T0');
  }
});

test('resumeCard(null) returns defaults with warning', () => {
  const c = resumeCard(null);
  assert.ok(c.warnings.some((w) => w.includes('not an object')));
});

test('resumeCard clamps invalid maxAgeDays with warning; unparseable time warned', () => {
  const state = {
    tier: 'T1', phase: 'M0', mode: 'PLAN',
    evidence: [{ id: 'BADTIME', level: 'E2', source: 's', time: 'not-a-date', scope: 'x', repro: 'r' }],
  };
  const c = resumeCard(state, { nowIso: '2026-08-25T00:00:00Z', maxAgeDays: -7 });
  assert.ok(c.warnings.some((w) => w.includes('maxAgeDays')));
  assert.ok(c.warnings.some((w) => w.includes('unparseable time')));
  assert.deepEqual(c.staleEvidenceIds, []);
});

test('resumeCard warns when now unparseable', () => {
  const c = resumeCard({ tier: 'T1', phase: 'M0', mode: 'PLAN', evidence: [] }, { now: 'garbage' });
  assert.ok(c.warnings.some((w) => w.includes('now')));
});

test('gatePrecheck guards null reports entries and non-array reports', () => {
  const a = gatePrecheck({ reports: [null] });
  assert.equal(a.pass, false);
  assert.ok(a.violations.some((v) => v.type === 'BAD_REPORT'));
  const b = gatePrecheck({ reviewerIds: [], reports: 'nope' });
  assert.equal(b.pass, true, 'non-array reports treated as absent');
});

test('gatePrecheck flags proposer identical to executor (referee separation)', () => {
  const r = gatePrecheck({
    proposalAuthorId: 'p1', executorId: 'p1',
    reviewerIds: ['r1'],
    reports: [{ reviewerId: 'r1', verdict: 'pass', anchors: ['a:1'] }],
  });
  assert.equal(r.pass, false);
  assert.ok(r.violations.some((v) => v.type === 'PROPOSER_IS_EXECUTOR'));
});

test('releaseAudit BAD_INPUT on non-object/non-files input', () => {
  assert.equal(releaseAudit(null)[0].type, 'BAD_INPUT');
  assert.equal(releaseAudit({ allowlist: [], files: 'x' })[0].type, 'BAD_INPUT');
});

test('releaseAudit flags UNSCANNED when content missing under contentScan', () => {
  const v = releaseAudit({ allowlist: ['a.md'], files: [{ path: 'a.md' }] });
  assert.ok(v.some((x) => x.type === 'UNSCANNED'));
});

test('releaseAudit extended token families + windows path + /root', () => {
  const content = [
    'C:\\Users\\john\\file.txt',
    'key sk-ant-api03-abcdefgh1234567890',
    'tok gho_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    'id AKIAABCDEFGHIJKLMNOP',
    'k AIzaSyABCDEF-_1234567890',
    '/root/.ssh/id_rsa',
  ].join('\n');
  const types = releaseAudit({ allowlist: ['a'], files: [{ path: 'a', content }] }).map((x) => x.type);
  assert.equal(types.filter((t) => t === 'ABS_PATH').length, 2);
  assert.equal(types.filter((t) => t === 'TOKEN_SUSPECT').length, 4);
});

test('planLint errors on string/null ledger items instead of passing clean', () => {
  const f = planLint({
    goal: 'g', metric: 'm', target: 't',
    assumptions: ['just a claim'],
    decisions: [null],
    risks: ['risk text'],
    dependencies: [{ what: 'db', blocker: 'up first' }],
  });
  const paths = f.map((x) => x.path).join('|');
  assert.match(paths, /assumptions\[0\]/);
  assert.match(paths, /decisions\[0\]/);
  assert.match(paths, /risks\[0\]/);
});
