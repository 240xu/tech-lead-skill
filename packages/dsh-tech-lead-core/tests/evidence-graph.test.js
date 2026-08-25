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
