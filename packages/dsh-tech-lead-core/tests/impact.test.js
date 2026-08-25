import test from 'node:test';
import assert from 'node:assert/strict';
import { changeImpact } from '../src/impact.js';

test('protected public cross-module change is high impact', () => {
  const result = changeImpact({ modules: ['a', 'b'], assets: ['CONFIG'], publicInterface: true, irreversible: true }, { gates: [{ id: 'g1' }] });
  assert.equal(result.tier, 'T2');
  assert.equal(result.reversible, false);
  assert.ok(result.reopenGates.includes('g1'));
});

test('source-only reversible change is low impact', () => {
  const result = changeImpact({ modules: ['a'], assets: ['SOURCE'], irreversible: false }, { gates: [] });
  assert.equal(result.tier, 'T0');
  assert.equal(result.reversible, true);
});

test('truthy irreversible keeps tier and reversibility consistent', () => {
  const r = changeImpact({ modules: ['a'], assets: [], irreversible: 'yes' }, { gates: [] });
  assert.equal(r.tier, 'T2');
  assert.equal(r.reversible, false);
});
