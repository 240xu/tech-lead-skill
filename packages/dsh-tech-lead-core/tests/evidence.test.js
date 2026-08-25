import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceLint } from '../src/evidence.js';

const good = (over = {}) => ({
  id: 'E-1', level: 'E2', source: 'node --test',
  time: '2026-08-25T00:00:00Z', scope: 'unit', repro: 'npm test', ...over,
});

test('complete evidence passes clean', () => {
  assert.deepEqual(evidenceLint([good()]), []);
});

test('missing provenance fields and bad levels are errors with paths', () => {
  const findings = evidenceLint([
    { id: 'A', level: 'E7', source: '', time: '', scope: '', repro: '' },
  ]);
  assert.equal(findings.filter((f) => f.severity === 'error').length >= 4, true);
  const paths = findings.map((f) => f.path).join('|');
  assert.match(paths, /\[0\]\.level/);
  assert.match(paths, /\[0\]\.source/);
});

test('high-risk change citing only E0-E2 fails; E3 passes', () => {
  const low = evidenceLint([good({ level: 'E2' })], { highRiskChange: true });
  assert.equal(low.some((f) => f.severity === 'error'), true);
  const ok = evidenceLint(
    [good({ level: 'E3', source: 'integration run' })],
    { highRiskChange: true }
  );
  assert.deepEqual(ok, []);
  const empty = evidenceLint([], { highRiskChange: true });
  assert.equal(empty.some((f) => f.severity === 'error'), true);
});

test('non-array input is a single error finding, not a throw', () => {
  const findings = evidenceLint(null);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'error');
});
