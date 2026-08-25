import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEnvelope, okEnvelope, errorEnvelope } from '../src/envelope.js';

test('success envelope has the stable result v1 shape', () => {
  const result = okEnvelope('state_validate', { valid: true });
  assert.deepEqual(result, {
    ok: true,
    code: 'OK',
    data: { valid: true },
    errors: [],
    warnings: [],
    meta: {
      schema: 'tech-lead.result.v1',
      operation: 'state_validate',
      deterministic: true,
      sideEffects: false,
    },
  });
});

test('error envelope preserves structured errors and normalizes arrays', () => {
  const result = errorEnvelope('state_validate', 'SCHEMA_INVALID', { path: 'mode' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SCHEMA_INVALID');
  assert.deepEqual(result.errors, [{ path: 'mode' }]);
  assert.deepEqual(result.warnings, []);
});

test('makeEnvelope does not mutate caller arrays', () => {
  const errors = [{ code: 'X' }];
  const result = makeEnvelope({ ok: false, code: 'BAD_INPUT', errors });
  errors.push({ code: 'Y' });
  assert.deepEqual(result.errors, [{ code: 'X' }]);
});

test('envelope contract metadata cannot be overridden by callers', () => {
  const result = makeEnvelope({ meta: { schema: 'other', deterministic: false, sideEffects: true } });
  assert.equal(result.meta.schema, 'tech-lead.result.v1');
  assert.equal(result.meta.deterministic, true);
  assert.equal(result.meta.sideEffects, false);
});

test('okEnvelope accepts extra meta while contract fields stay authoritative', () => {
  const e = okEnvelope('op', { x: 1 }, [], { deterministic: false, tag: 't' });
  assert.equal(e.meta.deterministic, true);
  assert.equal(e.meta.tag, 't');
});
