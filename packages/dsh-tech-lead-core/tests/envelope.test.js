import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEnvelope, okEnvelope, errorEnvelope } from '../src/envelope.js';

test('success envelope has the stable result v2 shape', () => {
  const result = okEnvelope('state_validate', { valid: true });
  assert.deepEqual(result, {
    ok: true,
    code: 'OK',
    data: { valid: true },
    findings: [],
    guidance: null,
    errors: [],
    warnings: [],
    meta: {
      complete: true,
      schema: 'tech-lead.result.v2',
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

test('contract fields stay authoritative except an explicit deterministic:false is honored', () => {
  const result = makeEnvelope({ meta: { schema: 'other', deterministic: false, sideEffects: true } });
  assert.equal(result.meta.schema, 'tech-lead.result.v2');
  assert.equal(result.meta.deterministic, false);
  assert.equal(result.meta.sideEffects, false);
});

test('okEnvelope accepts extra meta; explicit deterministic:false survives', () => {
  const e = okEnvelope('op', { x: 1 }, [], { deterministic: false, tag: 't' });
  assert.equal(e.meta.deterministic, false);
  assert.equal(e.meta.tag, 't');
});
