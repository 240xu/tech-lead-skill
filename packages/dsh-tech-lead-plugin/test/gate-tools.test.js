import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTools } from '../src/tools.js';
import * as core from '@240xu/dsh-tech-lead-core';

const tool = (name) => registerTools((definition) => definition, core).find((item) => item.name === name);

test('gate orchestration tools are registered', () => {
  for (const name of ['tech_lead_gate_plan', 'tech_lead_gate_aggregate', 'tech_lead_gate_reopen']) assert.ok(tool(name));
});

test('gate aggregate reports a valid conditional analysis under ok:true', async () => {
  const result = JSON.parse(await tool('tech_lead_gate_aggregate').execute({
    reportsJson: JSON.stringify([{ role: 'pm', verdict: 'pass', anchors: ['a'] }]),
    planJson: JSON.stringify({ requiredRoles: ['pm', 'arch'], quorum: 2 }),
  }));
  assert.equal(result.ok, true);
  assert.equal(result.code, 'OK');
  assert.equal(result.data.pass, false);
  assert.equal(result.data.verdict, 'conditional');
  assert.ok(result.data.guidance.nextActions.some((a) => a.kind === 'gate'));
});

test('gate reopen reports drift as a valid analysis', async () => {
  const result = JSON.parse(await tool('tech_lead_gate_reopen').execute({
    previousJson: JSON.stringify({ contextFingerprint: 'a' }),
    currentJson: JSON.stringify({ contextFingerprint: 'b' }),
  }));
  assert.equal(result.ok, true);
  assert.equal(result.code, 'OK');
  assert.equal(result.data.reopen, true);
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
  assert.equal(r.code, 'OK');
  assert.ok(r.data.findings.some((e) => e.code === 'MISSING_ROLE'));
});

test('gate reopen rejects snapshots without any known fingerprint key', async () => {
  const r = JSON.parse(await tool('tech_lead_gate_reopen').execute({
    previousJson: '{"fingerprint":"a"}', currentJson: '{"fingerprint":"b"}',
  }));
  assert.equal(r.code, 'BAD_INPUT');
  assert.match(JSON.stringify(r.errors), /contextFingerprint/);
});

test('conditional-only block names its cause instead of empty errors', async () => {
  const r = JSON.parse(await tool('tech_lead_gate_aggregate').execute({
    reportsJson: '[{"role":"pm","verdict":"conditional","anchors":["a"]},{"role":"eng","verdict":"pass","anchors":["b"]},{"role":"ops","verdict":"pass","anchors":["c"]}]',
    planJson: '{"requiredRoles":["pm","eng","ops"],"quorum":3}',
  }));
  assert.equal(r.code, 'OK');
  assert.ok(r.data.findings.some((e) => e.code === 'CONDITIONAL_VERDICT'));
});
