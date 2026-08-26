import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/classify.js';

test('trivial single-file task is T0', () => {
  const r = classify({});
  assert.equal(r.tier, 'T0');
  assert.ok(r.reasons.length >= 1);
});

test('multi-module or irreversible or protected assets force T2', () => {
  for (const input of [
    { touchesMultipleModules: true },
    { irreversibleOps: ['drop-table'] },
    { protectedAssetTypes: ['USER_DATA'] },
    { protectedAssetTypes: ['SECRET'] },
    { protectedAssetTypes: ['RUNTIME'] },
    { publicInterfaceChange: true },
  ]) {
    const r = classify(input);
    assert.equal(r.tier, 'T2', JSON.stringify(input));
  }
});

test('single module with duration lands T1', () => {
  assert.equal(classify({ estimatedDays: 2 }).tier, 'T1');
  assert.equal(classify({ estimatedDays: 3 }).tier, 'T1');
});

test('uncertain risk escalates exactly one tier', () => {
  assert.equal(classify({ uncertainRisk: true }).tier, 'T1');
  assert.equal(classify({ estimatedDays: 2, uncertainRisk: true }).tier, 'T2');
  assert.equal(classify({ touchesMultipleModules: true, uncertainRisk: true }).escalated, false);
});

test('reasons cite the triggering rule', () => {
  const r = classify({ irreversibleOps: ['rm -rf /tmp/x'], estimatedDays: 5 });
  assert.equal(r.tier, 'T2');
  assert.ok(r.reasons.some((s) => s.includes('irreversible')));
});

test('truthy-but-not-true flags do not emit mismatched reasons', () => {
  const r = classify({ touchesMultipleModules: 'yes', publicInterfaceChange: 'yes' });
  assert.equal(r.tier, 'T0');
  assert.equal(r.reasons.some((x) => x.includes('T2')), false);
});

test('input-free classification states its defaulting instead of asserting triviality', () => {
  const r = classify({});
  assert.ok(r.reasons.some((x) => /no .*inputs/i.test(x)));
});

test('cross-week single-module estimates force T2 per SKILL §1', () => {
  assert.equal(classify({ estimatedDays: 30 }).tier, 'T2');
  assert.ok(classify({ estimatedDays: 30 }).reasons.some((x) => x.includes('week')));
  assert.equal(classify({ estimatedDays: 6 }).tier, 'T1');
});
