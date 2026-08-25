import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTools } from '../src/tools.js';
import * as core from '@240xu/dsh-tech-lead-core';

const tool = (name) => registerTools((definition) => definition, core).find((item) => item.name === name);

test('progress tools are registered', () => {
  for (const name of ['tech_lead_progress_decide', 'tech_lead_critical_path', 'tech_lead_change_impact', 'tech_lead_resume_reconcile']) assert.ok(tool(name));
});

test('progress decision reports a blocked pause', async () => {
  const result = JSON.parse(await tool('tech_lead_progress_decide').execute({ contextJson: JSON.stringify({ dependencies: [{ id: 'd1', blocker: true, status: 'open' }] }) }));
  assert.equal(result.data.outcome, 'PAUSE');
});

test('critical path tool returns graph findings', async () => {
  const result = JSON.parse(await tool('tech_lead_critical_path').execute({ tasksJson: JSON.stringify([{ id: 'a' }]), dependenciesJson: '[]' }));
  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.data.parallelWindows));
});

test('progress decision rejects malformed optional options instead of throwing', async () => {
  const result = JSON.parse(await tool('tech_lead_progress_decide').execute({ contextJson: '{}', optionsJson: '{' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BAD_INPUT');
});
