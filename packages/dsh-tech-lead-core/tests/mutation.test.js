import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMutationIntent, previewMutation } from '../src/mutation.js';

const valid = () => ({
  schema: 'tech-lead.mutation-intent.v1', mode: 'read-only-preview',
  target: [{ path: 'src/a.js', assetType: 'SOURCE', operation: 'modify' }],
  expectedDiff: [{ path: 'src/a.js', summary: 'change' }],
  recoveryPoint: { required: true, description: 'git commit' },
  verification: [{ command: 'npm test', expected: 'pass' }],
  authorization: { required: true, status: 'missing' },
});

test('valid mutation intent is previewable but not executable', () => {
  assert.equal(validateMutationIntent(valid()).valid, true);
  const result = previewMutation(valid());
  assert.equal(result.ok, true);
  assert.equal(result.data.execution, 'not performed');
});

test('apply and execute modes are capability denied', () => {
  for (const mode of ['apply', 'execute', 'deploy']) {
    const result = previewMutation({ ...valid(), mode });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'CAPABILITY_DENIED');
  }
});

test('missing recovery and verification fields are invalid', () => {
  const input = valid();
  delete input.recoveryPoint;
  input.verification = [];
  assert.equal(validateMutationIntent(input).valid, false);
});

test('mutation preview refuses executable target operations and returns defensive data', () => {
  const input = valid();
  input.target = [{ path: 'production', operation: 'deploy' }];
  assert.equal(previewMutation(input).ok, false);

  const preview = previewMutation(valid());
  preview.data.targets[0].path = 'changed';
  assert.notEqual(valid().target[0].path, 'changed');
});

test('executable markers are denied regardless of casing or nesting', () => {
  for (const op of ['EXECUTE', 'Apply', ' deploy ']) {
    const intent = valid();
    intent.target = [{ path: 'x', operation: op }];
    const r = previewMutation(intent);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'CAPABILITY_DENIED');
  }
  const nested = valid();
  nested.expectedDiff = [{ summary: 'apply --force to prod' }];
  assert.equal(previewMutation(nested).code, 'CAPABILITY_DENIED');
});

test('unserializable payloads return SERIALIZATION_FAILED instead of throwing', () => {
  const circular = valid();
  circular.target = [];
  const node = { path: 'x' };
  node.self = node;
  circular.target.push(node);
  const r = previewMutation(circular);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'SERIALIZATION_FAILED');
});

test('preview output is defensive against later input mutation', () => {
  const input = valid();
  const preview = previewMutation(input);
  input.target[0].path = 'mutated-after-preview';
  assert.equal(preview.data.targets[0].path, 'src/a.js');
});
