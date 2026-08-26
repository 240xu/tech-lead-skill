import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTools } from '../src/tools.js';
import * as core from '@240xu/dsh-tech-lead-core';

const fakeDefineTool = (definition) => definition;

test('context tools are registered with stable names', () => {
  const tools = registerTools(fakeDefineTool, core);
  const names = tools.map((tool) => tool.name);
  assert.ok(names.includes('tech_lead_context_validate'));
  assert.ok(names.includes('tech_lead_evidence_graph_lint'));
  assert.ok(names.includes('tech_lead_evidence_freshness'));
  assert.ok(names.includes('tech_lead_assumption_register'));
});

test('context validation tool returns BAD_INPUT text for malformed JSON', async () => {
  const tool = registerTools(fakeDefineTool, core).find((item) => item.name === 'tech_lead_context_validate');
  const output = await tool.execute({ contextJson: '{' });
  const result = JSON.parse(output);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BAD_INPUT');
});

test('evidence freshness tool returns stale evidence deterministically', async () => {
  const tool = registerTools(fakeDefineTool, core).find((item) => item.name === 'tech_lead_evidence_freshness');
  const output = await tool.execute({
    contextJson: JSON.stringify({ evidence: [{ id: 'e1', time: '2026-08-01T00:00:00Z' }] }),
    optionsJson: JSON.stringify({ now: '2026-08-25T00:00:00Z', maxAgeDays: 7 }),
  });
  const result = JSON.parse(output);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'STALE_EVIDENCE');
  assert.equal(result.data.stale, true);
});

test('freshness envelope marks determinism honestly based on injected clock', async () => {
  const tools = registerTools(fakeDefineTool, core);
  const tool = tools.find((t) => t.name === 'tech_lead_evidence_freshness');
  const fresh = await tool.execute({ contextJson: '{"evidence":[]}' });
  assert.equal(JSON.parse(fresh).meta.deterministic, false);
  const pinned = await tool.execute({
    contextJson: '{"evidence":[]}',
    optionsJson: '{"now":"2026-08-25T00:00:00Z"}',
  });
  assert.equal(JSON.parse(pinned).meta.deterministic, true);
});

test('schema errors carry the uniform code field on the context surface', async () => {
  const tools = registerTools(fakeDefineTool, core);
  const tool = tools.find((t) => t.name === 'tech_lead_context_validate');
  const r = JSON.parse(await tool.execute({ contextJson: '{"schema":"tech-lead.context.v1"}' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 1);
  assert.ok(r.errors.every((e) => typeof e.code === 'string'));
});

test('whitespace-only verification is missing_verification, not verifiable', async () => {
  const tools = registerTools(fakeDefineTool, core);
  const tool = tools.find((t) => t.name === 'tech_lead_assumption_register');
  const r = JSON.parse(await tool.execute({ contextJson: '{"assumptions":[{"id":"A1","verification":"   "}]}'}));
  assert.equal(r.code, 'SCHEMA_INVALID');
  assert.equal(r.errors[0].code, 'MISSING_VERIFICATION');
});
