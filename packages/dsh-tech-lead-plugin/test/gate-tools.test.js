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

test('gate tools return BAD_INPUT for JSON null roots and malformed aggregate schemas', async () => {
  const planResult = JSON.parse(await tool('tech_lead_gate_plan').execute({ impactJson: 'null', contextJson: '{}' }));
  const aggregateResult = JSON.parse(await tool('tech_lead_gate_aggregate').execute({ reportsJson: '{}', planJson: '{}' }));
  assert.equal(planResult.code, 'BAD_INPUT');
  assert.equal(aggregateResult.code, 'BAD_INPUT');
});

test('gate plan reports every failing argument at once', async () => {
  const result = JSON.parse(await tool('tech_lead_gate_plan').execute({ impactJson: '{', contextJson: '}' }));
  assert.equal(result.code, 'BAD_INPUT');
  assert.equal(result.errors.length, 2);
});

test('blocked aggregation derives actionable MISSING_ROLE error entries', async () => {
  const r = JSON.parse(await tool('tech_lead_gate_aggregate').execute({
    reportsJson: '[{"role":"eng","verdict":"pass","anchors":["a"]}]',
    planJson: '{"requiredRoles":["eng","arch"],"quorum":2}',
  }));
  assert.equal(r.code, 'GATE_BLOCKED');
  assert.ok(r.errors.some((e) => e.code === 'MISSING_ROLE'));
});

test('gate reopen rejects snapshots without any known fingerprint key', async () => {
  const r = JSON.parse(await tool('tech_lead_gate_reopen').execute({
    previousJson: '{"fingerprint":"a"}', currentJson: '{"fingerprint":"b"}',
  }));
  assert.equal(r.code, 'BAD_INPUT');
  assert.match(JSON.stringify(r.errors), /contextFingerprint/);
});
