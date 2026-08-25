import test from 'node:test';
import assert from 'node:assert/strict';
import { criticalPath } from '../src/critical-path.js';

test('critical path finds chain and independent parallel task', () => {
  const result = criticalPath([
    { id: 'a', status: 'open' }, { id: 'b', status: 'open' }, { id: 'c', status: 'open' },
  ], [{ from: 'b', to: 'a' }]);
  assert.deepEqual(result.criticalPath, ['a', 'b']);
  assert.ok(result.parallelWindows.some((window) => window.includes('c')));
});

test('critical path reports cycles and unknown dependencies', () => {
  const result = criticalPath([{ id: 'a' }, { id: 'b' }], [
    { from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'x', to: 'a' },
  ]);
  assert.ok(result.findings.some((item) => item.code === 'CYCLE'));
  assert.ok(result.findings.some((item) => item.code === 'UNKNOWN_DEPENDENCY'));
});
