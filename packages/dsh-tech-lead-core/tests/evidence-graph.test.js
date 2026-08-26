import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceGraphLint, evidenceFreshness } from '../src/evidence-graph.js';

const context = (overrides = {}) => ({
  goalLedger: [{ id: 'g1' }],
  risks: [{ id: 'r1' }],
  decisions: [{ id: 'd1' }],
  gates: [{ id: 'gate1' }],
  evidence: [{ id: 'e1', supports: ['g1'], level: 'E3', source: 'test', time: '2026-08-24T00:00:00Z', scope: 'local', repro: 'run' }],
  ...overrides,
});

test('supported evidence produces a valid graph', () => {
  const result = evidenceGraphLint(context());
  assert.equal(result.valid, true);
  assert.equal(result.graph.edges.length, 1);
});

test('orphan references and duplicate evidence are findings', () => {
  const result = evidenceGraphLint(context({ evidence: [
    { id: 'e1', supports: ['missing'], level: 'E3' },
    { id: 'e1', supports: ['g1'], level: 'E3' },
  ] }));
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === 'UNKNOWN_REFERENCE'));
  assert.ok(result.findings.some((item) => item.code === 'DUPLICATE_ID'));
});

test('freshness detects stale and fingerprint-drifted evidence', () => {
  const result = evidenceFreshness({
    evidence: [{ id: 'e1', time: '2026-08-01T00:00:00Z', scope: 'local', fingerprint: 'old' }],
  }, { now: '2026-08-25T00:00:00Z', maxAgeDays: 7, fingerprint: 'new' });
  assert.equal(result.stale, true);
  assert.ok(result.findings.some((item) => item.code === 'STALE_EVIDENCE'));
  assert.ok(result.findings.some((item) => item.code === 'FINGERPRINT_DRIFT'));
});

test('invalid freshness options warn and use seven-day default', () => {
  const result = evidenceFreshness({ evidence: [] }, { maxAgeDays: -1 });
  assert.ok(result.warnings.some((item) => item.code === 'INVALID_MAX_AGE'));
});

test('evidence graph supports forward references and rejects cycles', () => {
  const result = evidenceGraphLint(context({ evidence: [
    { id: 'e1', supports: ['e2'] },
    { id: 'e2', supports: ['e1'] },
  ] }));
  assert.equal(result.valid, false);
  assert.equal(result.findings.some((item) => item.code === 'UNKNOWN_REFERENCE'), false);
  assert.ok(result.findings.some((item) => item.code === 'CYCLE'));
});

test('freshness rejects null options and invalid clocks without throwing', () => {
  assert.doesNotThrow(() => evidenceFreshness({ evidence: [] }, null));
  const result = evidenceFreshness({ evidence: [{ id: 'e1', time: '2020-01-01T00:00:00Z' }] }, { now: 'bad-clock' });
  assert.ok(result.warnings.some((item) => item.code === 'INVALID_NOW'));
  assert.equal(result.stale, true);
});

test('omitted maxAgeDays does not warn; invalid provided values warn with default', () => {
  const omitted = evidenceFreshness({ evidence: [] }, { now: '2026-08-25T00:00:00Z' });
  assert.equal(omitted.warnings.some((w) => w.code === 'INVALID_MAX_AGE'), false);
  const coerced = evidenceFreshness({ evidence: [] }, { maxAgeDays: null });
  assert.ok(coerced.warnings.some((w) => w.code === 'INVALID_MAX_AGE'));
  const str = evidenceFreshness({
    evidence: [{ id: 'e1', time: '2026-08-24T00:00:00Z' }],
  }, { now: '2026-08-25T00:00:00Z', maxAgeDays: '3' });
  assert.equal(str.stale, false);
});

test('deep support chains are traversed iteratively without stack overflow', () => {
  const n = 20000;
  const evidence = Array.from({ length: n }, (_, i) => ({ id: `a${i}`, supports: i + 1 < n ? [`a${i + 1}`] : ['g1'] }));
  const result = evidenceGraphLint({ goalLedger: [{ id: 'g1' }], evidence });
  assert.equal(result.valid, true);
  assert.equal(result.graph.edges.length, n);
});

test('malformed ledger entries produce symmetric findings', () => {
  const result = evidenceGraphLint(context({ goalLedger: [null, { id: '' }], evidence: [] }));
  assert.equal(result.valid, false);
  assert.ok(result.findings.filter((f) => f.code === 'INVALID_LEDGER_ENTRY').length >= 2);
});

test('self-referencing evidence is flagged as a cycle', () => {
  const result = evidenceGraphLint(context({ evidence: [{ id: 's1', supports: ['s1'] }] }));
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((f) => f.code === 'CYCLE'));
});

test('omitted maxAgeDays uses the documented seven-day boundary', () => {
  const opts = { now: '2026-08-25T00:00:00Z' };
  const fresh = evidenceFreshness({ evidence: [{ id: 'e', time: '2026-08-19T00:00:00Z' }] }, opts);
  assert.equal(fresh.stale, false);
  const boundary = evidenceFreshness({ evidence: [{ id: 'e', time: '2026-08-18T00:00:00Z' }] }, opts);
  assert.equal(boundary.stale, false);
  const stale = evidenceFreshness({ evidence: [{ id: 'e', time: '2026-08-17T23:00:00Z' }] }, opts);
  assert.equal(stale.stale, true);
});

test('future-dated evidence fails the freshness gate', () => {
  const r = evidenceFreshness({ evidence: [{ id: 'f', time: '2999-01-01T00:00:00Z' }] }, { now: '2026-08-25T00:00:00Z' });
  assert.equal(r.stale, true);
  assert.ok(r.findings.some((f) => f.code === 'FUTURE_EVIDENCE'));
});
