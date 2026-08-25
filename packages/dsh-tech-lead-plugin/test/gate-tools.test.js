import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTools } from '../src/tools.js';
import * as core from '@240xu/dsh-tech-lead-core';

const tool = (name) => registerTools((definition) => definition, core).find((item) => item.name === name);

test('gate orchestration tools are registered', () => {
  for (const name of ['tech_lead_gate_plan', 'tech_lead_gate_aggregate', 'tech_lead_gate_reopen']) assert.ok(tool(name));
});

test('gate aggregate rejects missing required role', async () => {
  const result = JSON.parse(await tool('tech_lead_gate_aggregate').execute({
    reportsJson: JSON.stringify([{ role: 'pm', verdict: 'pass', anchors: ['a'] }]),
    planJson: JSON.stringify({ requiredRoles: ['pm', 'arch'], quorum: 2 }),
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'GATE_BLOCKED');
});

test('gate reopen reports drift', async () => {
  const result = JSON.parse(await tool('tech_lead_gate_reopen').execute({
    previousJson: JSON.stringify({ contextFingerprint: 'a' }),
    currentJson: JSON.stringify({ contextFingerprint: 'b' }),
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DRIFT_DETECTED');
});
