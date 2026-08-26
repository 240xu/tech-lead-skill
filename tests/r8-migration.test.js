import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/state-v1/${name}.json`, import.meta.url), 'utf8'));
const FIXTURES = ['normal', 'degraded-stop', 'active-gates', 'completed', 'unknown-ext'].map(fx);

// R8 contracts live in two new pure modules; import through the package index
// so workspace runs and the built artifact exercise the same surface.
import {
  validateContextV2, projectStateToContextV2, parseProtocolOptions,
} from '../packages/dsh-tech-lead-core/src/index.js';
import { registerTools } from '../packages/dsh-tech-lead-plugin/src/tools.js';
import * as core from '../packages/dsh-tech-lead-core/src/index.js';
const makeTools = () => registerTools((d) => d, core);

test('five representative state v1 fixtures all project into valid context v2', () => {
  for (const [i, state] of FIXTURES.entries()) {
    const r = projectStateToContextV2(state, {
      projectId: `p${i}`, projectName: `proj-${i}`,
      snapshotSource: 'inline', snapshotFingerprint: `fp-${i}`, at: '2026-08-26T00:00:00Z',
    });
    assert.equal(r.ok, true, `fixture ${i}: ${JSON.stringify(r.errors ?? [])}`);
    const v = validateContextV2(r.value, { mode: 'strict' });
    assert.equal(v.valid, true, `fixture ${i} validate: ${JSON.stringify(v.errors ?? [])}`);
    assert.equal(r.value.version, 2);
  }
});

test('projection maps every known v1 field to its exact v2 location', () => {
  const state = fx('normal');
  const { value } = projectStateToContextV2(state, {
    projectId: 'px', projectName: 'PX', snapshotSource: 'inline',
    snapshotFingerprint: 'fpx', at: '2026-08-26T01:00:00Z',
  });
  assert.equal(value.current.mode, state.mode);
  assert.equal(value.current.tier, state.tier);
  assert.equal(value.current.phase, state.phase);
  assert.equal(value.current.lastOutcome, state.last_outcome);
  assert.equal(value.current.nextStep, state.next_step);
  assert.equal(value.project.repositoryMode, state.repository_mode);
  assert.equal(value.state.persistence, state.state_persistence);
  assert.equal(value.snapshot.at, '2026-08-26T01:00:00Z');
  assert.deepEqual(value.goalLedger, state.goal_ledger);
  assert.deepEqual(value.nonGoals, state.non_goals);
  assert.deepEqual(value.state.openGates, state.open_gates);
  assert.deepEqual(value.state.criticalPath, state.critical_path);
  assert.deepEqual(value.state.protectedAssets, state.protected_assets);
  assert.deepEqual(value.state.hypotheses, state.hypotheses);
  assert.equal(value.state.nextReviewTrigger, state.next_review_trigger);
  assert.equal(value.state.degradedReason, state.degraded_reason);
  assert.deepEqual(value.state.tags, state.tags);
  // passthrough collections keep identity
  assert.deepEqual(value.evidence, state.evidence);
  assert.deepEqual(value.constraints, state.constraints);
  assert.deepEqual(value.decisions, state.decisions);
  assert.deepEqual(value.risks, state.risks);
  assert.deepEqual(value.dependencies, state.dependencies);
});

test('identity/fingerprint/source are required options — no invented defaults (NON_CONVERTIBLE_STATE)', () => {
  const state = fx('normal');
  const base = { projectName: 'P', snapshotSource: 'inline', snapshotFingerprint: 'f', at: '2026-08-26T00:00:00Z' };
  const missingId = projectStateToContextV2(state, base);
  assert.equal(missingId.ok, false);
  assert.equal(missingId.code, 'NON_CONVERTIBLE_STATE');
  const noFp = projectStateToContextV2(state, { ...base, projectId: 'p', snapshotFingerprint: undefined });
  assert.equal(noFp.ok, false);
  assert.equal(noFp.code, 'NON_CONVERTIBLE_STATE');
});

test('extensions survive both modes; unknown TOP-LEVEL fields are rejected (strict hardest)', () => {
  const { value: ctx } = projectStateToContextV2(fx('unknown-ext'), {
    projectId: 'p', projectName: 'P', snapshotSource: 'inline',
    snapshotFingerprint: 'f', at: '2026-08-26T00:00:00Z',
  });
  assert.ok(ctx.extensions['vendor_custom']);
  assert.equal(validateContextV2(ctx, { mode: 'strict' }).valid, true);
  const compat = validateContextV2(ctx, { mode: 'compat' });
  assert.equal(compat.valid, true);
  assert.ok(compat.warnings.some((w) => w.code === 'EXTENSION_PASSTHROUGH'));

  const rogue = { ...ctx, rogue_top: 1 };
  const strictRogue = validateContextV2(rogue, { mode: 'strict' });
  assert.equal(strictRogue.valid, false);
  assert.ok(strictRogue.errors.some((e) => e.path === '/rogue_top'));
  const compatRogue = validateContextV2(rogue, { mode: 'compat' });
  assert.equal(compatRogue.valid, false);
});

test('v1 string schema normalizes internally; wrong schema id is rejected', () => {
  const r1 = projectStateToContextV2(fx('normal'), {
    projectId: 'p', projectName: 'P', snapshotSource: 'inline',
    snapshotFingerprint: 'f', at: '2026-08-26T00:00:00Z',
  });
  assert.equal(r1.value.schema, 'tech-lead.context');
  const bad = validateContextV2({ ...r1.value, schema: 'something.else', version: 9 }, { mode: 'compat' });
  assert.equal(bad.valid, false);
  assert.equal(bad.code, 'UNSUPPORTED_SCHEMA_VERSION');
});

test('protocol negotiation parses explicit options and rejects unavailable selections', () => {
  assert.deepEqual(parseProtocolOptions(undefined), { ok: true, inputCompatibility: 'strict', outputProtocol: 'default' });
  assert.deepEqual(
    parseProtocolOptions('{"outputProtocol":"tech-lead.result.v2"}'),
    { ok: true, inputCompatibility: 'strict', outputProtocol: 'tech-lead.result.v2' },
  );
  const bad = parseProtocolOptions('{"outputProtocol":"bare"}');
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'UNSUPPORTED_SCHEMA_VERSION');
  const broken = parseProtocolOptions('{');
  assert.equal(broken.ok, false);
  assert.equal(broken.code, 'BAD_INPUT');
});

test('strengthened tools default to the tech-lead.result.v2 wire label', async () => {
  const out = JSON.parse(await makeTools().find((t) => t.name === 'tech_lead_progress_decide').execute({ contextJson: '{}' }));
  assert.equal(out.meta.schema, 'tech-lead.result.v2');
  assert.equal(out.meta.complete, true);
});

test('explicit protocolJson negotiates downgrades and legacy opt-ins', async () => {
  const tools = makeTools();
  const v1 = JSON.parse(await tools.find((t) => t.name === 'tech_lead_progress_decide').execute({
    contextJson: '{}', protocolJson: '{"outputProtocol":"tech-lead.result.v1"}',
  }));
  assert.equal(v1.meta.schema, 'tech-lead.result.v1');
  const legacy = JSON.parse(await tools.find((t) => t.name === 'tech_lead_progress_decide').execute({
    contextJson: '{}', protocolJson: '{"outputProtocol":"legacy"}',
  }));
  assert.equal(legacy.outcome, 'CONTINUE');
  assert.equal(legacy.meta, undefined);
});

test('legacy audits opt into envelopes without losing their data shape', async () => {
  const tools = makeTools();
  const state = fx('normal');
  const wrapped = JSON.parse(await tools.find((t) => t.name === 'tech_lead_state_validate').execute({
    stateJson: JSON.stringify(state), protocolJson: '{"outputProtocol":"tech-lead.result.v2"}',
  }));
  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.data.valid, true);
  assert.equal(wrapped.meta.schema, 'tech-lead.result.v2');
  // default stays bare
  const bare = JSON.parse(await tools.find((t) => t.name === 'tech_lead_state_validate').execute({ stateJson: JSON.stringify(state) }));
  assert.equal(bare.valid, true);
});

test('unsupported protocol selections fail with UNSUPPORTED_SCHEMA_VERSION', async () => {
  const out = JSON.parse(await makeTools().find((t) => t.name === 'tech_lead_progress_decide').execute({
    contextJson: '{}', protocolJson: '{"outputProtocol":"yaml"}',
  }));
  assert.equal(out.ok, false);
  assert.equal(out.code, 'UNSUPPORTED_SCHEMA_VERSION');
});
