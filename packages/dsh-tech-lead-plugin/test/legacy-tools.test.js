import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTools } from '../src/tools.js';
import * as core from '@240xu/dsh-tech-lead-core';

const tool = (name) => registerTools((definition) => definition, core).find((item) => item.name === name);
const run = async (name, args) => JSON.parse(await tool(name).execute(args));

test('classify maps csv primitive inputs onto the raw tier result', async () => {
  const r = await run('tech_lead_classify', {
    irreversibleOps: 'drop-table, force-push',
    estimatedDays: 0.5,
  });
  assert.equal(r.tier, 'T2');
  assert.equal(r.escalated, false);
  assert.ok(r.reasons.some((x) => x.includes('drop-table')));
});

test('state_validate keeps its raw validation shape and parse-failure shape', async () => {
  const good = await run('tech_lead_state_validate', {
    stateJson: JSON.stringify({
      schema_version: 1, mode: 'PLAN', tier: 'T0', phase: 'P', repository_mode: 'git',
      done: [], evidence: [], last_outcome: '', next_step: 'n', updated_at: '2026-08-25T00:00:00Z',
    }),
  });
  assert.equal(good.valid, true);
  const bad = await run('tech_lead_state_validate', { stateJson: '{' });
  assert.equal(bad.valid, false);
  assert.equal(bad.errors[0].path, 'stateJson');
  assert.deepEqual(bad.warnings, []);
});

test('transition_check denies unjustified pivot and reports parse failures via reason', async () => {
  const denied = await run('tech_lead_transition_check', {
    stateJson: '{"decisions":[]}', proposed: 'PIVOT',
  });
  assert.equal(denied.allowed, false);
  const broken = await run('tech_lead_transition_check', { stateJson: '{', proposed: 'PIVOT' });
  assert.equal(broken.allowed, false);
  assert.match(broken.reason, /invalid JSON/);
});

test('plan_lint emits raw findings arrays for both lint and parse paths', async () => {
  const missing = await run('tech_lead_plan_lint', { planJson: '{"goal":"g"}' });
  assert.ok(missing.some((f) => f.path === 'metric'));
  const broken = await run('tech_lead_plan_lint', { planJson: '{' });
  assert.equal(broken[0].severity, 'error');
  assert.equal(broken[0].path, 'planJson');
  assert.match(broken[0].message, /invalid JSON/);
});

test('evidence_lint enforces E3 minimum through the raw severity field', async () => {
  const r = await run('tech_lead_evidence_lint', {
    evidenceJson: '[{"id":"a","level":"E2","source":"s","time":"t","scope":"sc","repro":"r"}]',
    highRiskChange: true,
  });
  assert.ok(r.some((f) => f.severity === 'error'));
});

test('gate_precheck projects onto an envelope while preserving violation typing', async () => {
  const solo = await run('tech_lead_gate_precheck', {
    inputJson: '{"solo":true,"destructiveScope":["prod-db"]}',
  });
  assert.equal(solo.ok, true);
  assert.equal(solo.data.pass, false);
  assert.ok(solo.data.violations.some((v) => v.type === 'SOLO_FORBIDDEN'));
  const malformed = await run('tech_lead_gate_precheck', { inputJson: '{"reports":"nope"}' });
  assert.equal(malformed.ok, true);
  assert.equal(malformed.data.pass, false);
  assert.ok(malformed.data.violations.some((v) => v.type === 'BAD_REPORTS'));
  const broken = await run('tech_lead_gate_precheck', { inputJson: '{' });
  assert.equal(broken.ok, false);
  assert.equal(broken.code, 'BAD_INPUT');
  assert.equal(broken.data.violations[0].type, 'BAD_INPUT');
});

test('release_audit scans allowlist drift and degrades parse errors to typed entries', async () => {
  const extra = await run('tech_lead_release_audit', {
    allowlistCsv: 'README.md',
    filesJson: '[{"path":"extra.txt"}]',
  });
  assert.equal(extra[0].type, 'EXTRA_FILE');
  const broken = await run('tech_lead_release_audit', { allowlistCsv: 'a', filesJson: '{' });
  assert.equal(broken[0].type, 'BAD_INPUT');
  assert.equal(broken[0].line, 0);
});

test('install_audit reports manifest-shape errors inside the raw audit object', async () => {
  const malformed = await run('tech_lead_install_audit', {
    manifestJson: '"just-a-string"', actualFilesCsv: 'a', pkgFilesCsv: 'a', pkgVersion: '1',
  });
  assert.deepEqual(malformed.missingManaged, []);
  assert.match(malformed.error, /manifestJson/);
  const drifted = await run('tech_lead_install_audit', {
    manifestJson: '{"version":"5.4.3","files":["SKILL.md"]}',
    actualFilesCsv: 'SKILL.md, user-notes.txt',
    pkgFilesCsv: 'SKILL.md',
    pkgVersion: '5.4.3',
  });
  assert.deepEqual(drifted.unmanaged, ['user-notes.txt']);
  assert.equal(drifted.versionMismatch, false);
});

test('resume_card renders from defaults when the state cannot be parsed', async () => {
  const broken = await run('tech_lead_resume_card', { stateJson: '{' });
  assert.equal(broken.position, '?');
  assert.equal(broken.staleEvidenceIds.length, 0);
  const card = await run('tech_lead_resume_card', {
    stateJson: JSON.stringify({ tier: 'T1', phase: 'M2', mode: 'EXECUTE', evidence: [] }),
    nowIso: '2026-08-25T00:00:00Z',
  });
  assert.match(card.position, /T1/);
  assert.ok(card.position.includes('M2'));
});

test('input-free classification surfaces its defaulting through the tool layer', async () => {
  const r = await run('tech_lead_classify', {});
  assert.ok(r.reasons.some((x) => /no .*inputs/i.test(x)));
});
