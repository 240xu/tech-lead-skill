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
