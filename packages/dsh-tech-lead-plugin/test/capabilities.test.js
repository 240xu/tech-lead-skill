import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapabilities, name, inject, apply } from '../src/index.js';

test('plugin exposes the tech-lead capability catalog without changing its entrypoint', () => {
  assert.equal(name, 'tech-lead-tools');
  assert.deepEqual(inject, ['tools']);
  assert.equal(typeof apply, 'function');
  const capabilities = getCapabilities();
  assert.equal(capabilities.length, 21);
  assert.ok(capabilities.every((item) => item.sideEffects === false));
});
