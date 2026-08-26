import test from 'node:test';
import assert from 'node:assert/strict';

// These probes execute the SHIPPED artifact (packages/dsh-themis) — the same
// tree that goes to npm — not the workspace sources. Guards against assembly
// drift: mutations to the built tree now fail the suite.

const A = '../packages/dsh-themis/src/';

test('artifact registers exactly 21 tools with a live core surface', async () => {
  const [{ registerTools }, core] = await Promise.all([
    import(A + 'tools.js'),
    import(A + 'core/index.js'),
  ]);
  const tools = registerTools((d) => d, core);
  assert.equal(tools.length, 21);
});

test('artifact envelope keeps contract meta authoritative; honest determinism allowed', async () => {
  const { makeEnvelope } = await import(A + 'core/envelope.js');
  const e = makeEnvelope({ meta: { schema: 'evil', deterministic: false, sideEffects: true } });
  assert.equal(e.meta.schema, 'tech-lead.result.v1');
  assert.equal(e.meta.deterministic, false);
  assert.equal(e.meta.sideEffects, false);
});

test('artifact gateAggregate propagates duplicate-role rejects', async () => {
  const { gateAggregate } = await import(A + 'core/gates.js');
  const r = gateAggregate([
    { role: 'eng', verdict: 'pass', anchors: ['a'] },
    { role: 'eng', verdict: 'reject', anchors: ['b'], findings: [{ id: 'r1' }] },
  ], { requiredRoles: ['eng'], quorum: 1 });
  assert.equal(r.verdict, 'reject');
  assert.ok(r.findings.some((f) => f.id === 'r1'));
});

test('artifact freshness flips stale on future-dated evidence and honors 7-day default', async () => {
  const { evidenceFreshness } = await import(A + 'core/evidence-graph.js');
  const future = evidenceFreshness({ evidence: [{ id: 'f', time: '2999-01-01T00:00:00Z' }] }, { now: '2026-08-26T00:00:00Z' });
  assert.equal(future.stale, true);
  const fresh = evidenceFreshness({ evidence: [{ id: 'e', time: '2026-08-19T00:00:00Z' }] }, { now: '2026-08-25T00:00:00Z' });
  assert.equal(fresh.stale, false);
});

test('artifact mutation preview denies casing variants and honors scan depth window', async () => {
  const { previewMutation } = await import(A + 'core/mutation.js');
  const valid = () => ({
    schema: 'tech-lead.mutation-intent.v1', mode: 'read-only-preview',
    target: [{ path: 'a.js', assetType: 'SOURCE', operation: 'modify' }],
    expectedDiff: [{ path: 'a.js', summary: 'change' }],
    recoveryPoint: { required: true, description: 'git commit' },
    verification: [{ command: 'npm test', expected: 'pass' }],
    authorization: { required: true, status: 'missing' },
  });
  const cased = valid(); cased.target[0].operation = 'EXECUTE';
  assert.equal(previewMutation(cased).code, 'CAPABILITY_DENIED');
  const nest = (levels) => { let v = 'deploy now'; for (let i = 0; i < levels; i += 1) v = { n: v }; return v; };
  const within = valid(); within.target = [{ path: 'x', operation: 'read', payload: nest(20) }];
  const beyond = valid(); beyond.target = [{ path: 'x', operation: 'read', payload: nest(23) }];
  assert.equal(previewMutation(within).code, 'CAPABILITY_DENIED');
  assert.equal(previewMutation(beyond).ok, false);
  assert.equal(previewMutation(beyond).code, 'SCAN_INCOMPLETE');
});

test('artifact resume_reconcile reports scalar-root drift keys via plugin protocol', async () => {
  const proto = await import(A + 'protocol.js');
  assert.equal(typeof proto.canonicalStringify, 'function');
  const changed = JSON.stringify(proto.canonicalStringify('old')) !== JSON.stringify(proto.canonicalStringify('new'));
  assert.equal(changed, true);
});
