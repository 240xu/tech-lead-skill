import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTools } from '../src/tools.js';
import * as core from '@240xu/dsh-tech-lead-core';

test('mutation preview tool is registered and denies apply', async () => {
  const tool = registerTools((definition) => definition, core).find((item) => item.name === 'tech_lead_mutation_preview');
  assert.ok(tool);
  const result = JSON.parse(await tool.execute({ intentJson: JSON.stringify({ mode: 'apply' }) }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CAPABILITY_DENIED');
});

test('bad input errors carry the uniform BAD_INPUT code', async () => {
  const tool = registerTools((definition) => definition, core).find((item) => item.name === 'tech_lead_mutation_preview');
  const parsed = JSON.parse(await tool.execute({ intentJson: 42 }));
  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, 'BAD_INPUT');
  assert.equal(parsed.errors[0].code, 'BAD_INPUT');
});
