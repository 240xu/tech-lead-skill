import test from 'node:test';
import assert from 'node:assert/strict';
import { csv, parseJsonString, renderEnvelope } from '../src/protocol.js';

test('parseJsonString returns structured parse failure', () => {
  const result = parseJsonString('{', 'stateJson');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'BAD_INPUT');
  assert.equal(result.error.path, 'stateJson');
});

test('csv trims and removes empty values', () => {
  assert.deepEqual(csv(' SOURCE, ,SECRET, '), ['SOURCE', 'SECRET']);
  assert.deepEqual(csv(null), []);
});

test('renderEnvelope returns stable pretty JSON', () => {
  const text = renderEnvelope({ ok: true, code: 'OK', data: {} });
  assert.equal(text, '{\n  "ok": true,\n  "code": "OK",\n  "data": {}\n}');
});
