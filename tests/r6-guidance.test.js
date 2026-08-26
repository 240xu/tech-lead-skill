import test from 'node:test';
import assert from 'node:assert/strict';
// R6 acceptance probes. Core-level contracts live in dsh-tech-lead-core;
// this file exercises them through the same bare-specifier surface the
// plugin adapters use, so both workspace runs and artifact runs stay honest.

import {
  inspectBounded, parseBoundedJson, gatePrecheck,
} from '../packages/dsh-tech-lead-core/src/index.js';
import { registerTools } from '../packages/dsh-tech-lead-plugin/src/tools.js';
import * as core from '../packages/dsh-tech-lead-core/src/index.js';

const makeTools = () => registerTools((d) => d, core);

test('parseBoundedJson accepts small valid JSON and reports complete inspection', () => {
  const r = parseBoundedJson('input', '{"a":1}', 'default');
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { a: 1 });
  assert.equal(r.inspection.complete, true);
  assert.equal(r.inspection.nodes, 1);
  assert.equal(r.inspection.maxDepth, 0);
});

test('non-string input is BAD_INPUT before any parsing work', () => {
  const r = parseBoundedJson('input', 42, 'default');
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'BAD_INPUT');
});

test('invalid JSON keeps the legacy message prefix verbatim', () => {
  const r = parseBoundedJson('stateJson', '{', 'default');
  assert.equal(r.ok, false);
  assert.match(r.error.message, /^invalid JSON: /);
});

test('byte budget rejects oversized text before parsing (INPUT_TOO_LARGE)', () => {
  const big = '"' + 'a'.repeat(300000) + '"'; // ~300 KB valid JSON
  const r = parseBoundedJson('filesJson', big, 'default');
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'INPUT_TOO_LARGE');
  assert.ok(r.error.details.observed > r.error.details.limit);
});

test('array item budget flips to ITEM_LIMIT_EXCEEDED with stop location', () => {
  const r = parseBoundedJson('tasksJson', JSON.stringify(Array.from({ length: 2001 }, (_, i) => i)), 'default');
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'ITEM_LIMIT_EXCEEDED');
  assert.equal(r.error.details.kind, 'items');
  assert.equal(r.error.details.limit, 2000);
});

test('object key budget flips to ITEM_LIMIT_EXCEEDED', () => {
  const obj = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`k${i}`, 1]));
  const r = parseBoundedJson('planJson', JSON.stringify(obj), 'default');
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'ITEM_LIMIT_EXCEEDED');
  assert.equal(r.error.details.kind, 'keys');
});

test('depth beyond the profile stops the walk as SCAN_INCOMPLETE, never success', () => {
  let v = 1;
  for (let i = 0; i < 30; i += 1) v = { n: v };
  const r = parseBoundedJson('intentJson', JSON.stringify(v), 'default');
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'SCAN_INCOMPLETE');
  assert.equal(r.error.details.kind, 'depth');
});

test('node budget exhaustion fails closed even when structure is shallow', () => {
  const wide = Array.from({ length: 800 }, () => Object.fromEntries(
    Array.from({ length: 12 }, (_, k) => [`k${k}`, [0]]),
  )); // 800*13 + 1 ≈ 10401 containers, array length 800 stays under items cap
  const r = parseBoundedJson('contextJson', JSON.stringify(wide), 'default');
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'SCAN_INCOMPLETE');
  assert.equal(r.error.details.kind, 'nodes');
});

test('named profiles bound differently (mutation tighter than graph)', () => {
  const arr = Array.from({ length: 9000 }, () => ({ id: 'x' }));
  const text = JSON.stringify(arr);
  const tight = parseBoundedJson('intentJson', text, 'mutation');
  assert.equal(tight.ok, false);
  const wide = parseBoundedJson('tasksJson', text, 'graph');
  assert.equal(wide.ok, true);
  assert.equal(wide.inspection.complete, true);
});

test('inspectBounded is directly usable and never throws on hostile shapes', () => {
  const hostile = JSON.parse('{"a":[{"b":null},{"c":[[],{}]}]}');
  const r = inspectBounded(hostile, { bytes: 9, items: 10, keys: 10, nodes: 10, depth: 4 });
  assert.equal(typeof r.complete, 'boolean');
});

test('core gatePrecheck rejects supplied malformed reports instead of passing them (C1)', () => {
  const r = gatePrecheck({ reviewerIds: [], reports: 'nope' });
  assert.equal(r.pass, false);
  assert.ok(r.violations.some((v) => v.type === 'BAD_REPORTS'));
});

test('per-profile byte budgets surface INPUT_TOO_LARGE through adapters', async () => {
  const tools = makeTools();
  const tight = await tools.find((t) => t.name === 'tech_lead_mutation_preview').execute({
    intentJson: '{"mode":"read-only-preview","pad":"' + 'x'.repeat(300000) + '"}',
  });
  assert.equal(JSON.parse(tight).code, 'INPUT_TOO_LARGE');
  const wide = await tools.find((t) => t.name === 'tech_lead_context_validate').execute({
    contextJson: '{"evidence":["' + 'x'.repeat(1200000) + '"]}',
  });
  assert.equal(JSON.parse(wide).code, 'INPUT_TOO_LARGE');
});

test('budget codes are promoted to the envelope top level for multi-field adapters', async () => {
  const tools = makeTools();
  const bigTasks = '[' + '{"id":"x"},'.repeat(40000) + '{"id":"y"}]';
  const out = JSON.parse(await tools.find((t) => t.name === 'tech_lead_critical_path').execute({
    tasksJson: bigTasks, dependenciesJson: '[]',
  }));
  assert.equal(out.ok, false);
  assert.equal(out.code, 'INPUT_TOO_LARGE');
  assert.equal(out.errors[0].path, 'tasksJson');
});

test('progress options budget failures fail closed without executing the decision', async () => {
  const tools = makeTools();
  const out = JSON.parse(await tools.find((t) => t.name === 'tech_lead_progress_decide').execute({
    contextJson: '{}',
    optionsJson: '{"forcePivot":' + '['.repeat(300000) + ']}',
  }));
  assert.equal(out.ok, false);
  assert.ok(['INPUT_TOO_LARGE', 'BAD_INPUT'].includes(out.code));
});

test('legacy state_validate keeps its bare shape even for budget failures', async () => {
  const tools = makeTools();
  const out = JSON.parse(await tools.find((t) => t.name === 'tech_lead_state_validate').execute({
    stateJson: '"' + 'a'.repeat(600000) + '"',
  }));
  assert.equal(out.valid, false);
  assert.match(out.errors[0].message, /byte budget/);
});
