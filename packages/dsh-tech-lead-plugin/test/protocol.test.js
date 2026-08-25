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

test('parseJsonFields collects every failing field instead of short-circuiting', async () => {
  const { parseJsonFields } = await import('../src/protocol.js');
  const result = parseJsonFields({ a: '{', b: 42, c: '"ok"' }, ['a', 'b', 'c']);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 2);
  assert.deepEqual(result.errors.map((e) => e.path).sort(), ['a', 'b']);
  assert.equal(parseJsonFields({ c: '"ok"' }, ['c']).values.c, 'ok');
});

test('runGuarded converts unexpected throws into INTERNAL envelopes without stack leakage', async () => {
  const { runGuarded } = await import('../src/protocol.js');
  const text = runGuarded('op_x', () => { throw new TypeError('/secret/path exploded'); });
  const parsed = JSON.parse(text);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, 'INTERNAL');
  assert.equal(parsed.errors[0].code, 'INTERNAL');
  assert.match(parsed.errors[0].message, /TypeError/);
  assert.doesNotMatch(parsed.errors[0].message, /\/secret\/path/);
});
