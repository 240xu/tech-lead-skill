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

test('renderEnvelope clamps oversized findings arrays with a truncation marker', async () => {
  const { renderEnvelope } = await import('../src/protocol.js');
  const errors = Array.from({ length: 600 }, (_, i) => ({ code: 'E', path: `/x/${i}`, message: 'm' }));
  const text = renderEnvelope({ ok: false, code: 'SCHEMA_INVALID', errors, warnings: [] });
  const parsed = JSON.parse(text);
  assert.equal(parsed.errors.length, 500);
  assert.ok(parsed.warnings.some((w) => w.code === 'FINDINGS_TRUNCATED' && w.total === 600));
});

test('large envelopes switch to compact serialization', async () => {
  const { renderEnvelope } = await import('../src/protocol.js');
  const big = { ok: true, data: { blob: 'x'.repeat(300000) } };
  const text = renderEnvelope(big);
  assert.ok(text.length > 262144);
  assert.equal(text.includes('\n  '), false);
});

test('oversized caller-echo arrays collapse into truncation summaries', async () => {
  const { clampEnvelope } = await import('../src/protocol.js');
  const evidence = Array.from({ length: 150 }, (_, i) => ({ id: `e${i}` }));
  const out = clampEnvelope({ ok: true, data: { evidence } });
  assert.deepEqual(out.data.evidence, { truncated: true, total: 150 });
});
