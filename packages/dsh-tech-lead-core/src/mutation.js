import { errorEnvelope, okEnvelope } from './envelope.js';

const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => JSON.parse(JSON.stringify(value));
const EXECUTABLE_OPERATIONS = new Set(['apply', 'execute', 'deploy']);
const MARKER_PATTERN = /\b(apply|execute|deploy)\b/i;
const SCAN_BUDGET = { depth: 24, nodes: 8000, markers: 200 };

// Bounded capability scan. Budget exhaustion never silently ends the audit:
// the walk skips the over-budget subtree, keeps checking everything reachable,
// and reports completeness so the caller can fail closed when nothing was found.
const scanMarkers = (root) => {
  const markers = [];
  let nodes = 0;
  let stoppedAt = null;
  const stack = [[root, '', 0]];
  while (stack.length) {
    const [value, base, depth] = stack.pop();
    // Per-subtree budget gates: an over-budget subtree is skipped, its
    // siblings are still audited, and the first breach is reported once.
    if (depth > SCAN_BUDGET.depth) {
      if (!stoppedAt) stoppedAt = { kind: 'depth', path: base || '/', limit: SCAN_BUDGET.depth };
      continue;
    }
    if (typeof value === 'string') {
      if (MARKER_PATTERN.test(value) && markers.length < SCAN_BUDGET.markers) {
        markers.push({ path: base, code: 'CAPABILITY_DENIED', message: 'executable marker inside intent payload' });
      }
      continue;
    }
    if (value === null || typeof value !== 'object') continue;
    nodes += 1;
    if (nodes > SCAN_BUDGET.nodes) {
      if (!stoppedAt) stoppedAt = { kind: 'nodes', path: base || '/', limit: SCAN_BUDGET.nodes };
      continue;
    }
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i -= 1) stack.push([value[i], `${base}/${i}`, depth + 1]);
    } else {
      const keys = Object.keys(value);
      for (let i = keys.length - 1; i >= 0; i -= 1) stack.push([value[keys[i]], `${base}/${keys[i]}`, depth + 1]);
    }
  }
  return { markers, complete: !stoppedAt, stoppedAt };
};

export function validateMutationIntent(raw) {
  const errors = [];
  if (!object(raw)) return { valid: false, errors: [{ path: '/', message: 'intent must be an object' }], warnings: [] };
  if (raw.schema !== 'tech-lead.mutation-intent.v1') errors.push({ path: '/schema', message: 'invalid schema' });
  if (raw.mode !== 'read-only-preview') errors.push({ path: '/mode', code: 'CAPABILITY_DENIED', message: 'only read-only-preview is available' });
  if (!list(raw.target).length) errors.push({ path: '/target', message: 'at least one target is required' });
  for (const [index, target] of list(raw.target).entries()) if (EXECUTABLE_OPERATIONS.has(target?.operation)) errors.push({ path: `/target/${index}/operation`, code: 'CAPABILITY_DENIED', message: 'executable target operations are unavailable' });
  if (!list(raw.expectedDiff).length) errors.push({ path: '/expectedDiff', message: 'expectedDiff is required' });
  if (!object(raw.recoveryPoint) || raw.recoveryPoint.required !== true) errors.push({ path: '/recoveryPoint', message: 'recovery point is required' });
  if (!list(raw.verification).length) errors.push({ path: '/verification', message: 'verification is required' });
  if (!object(raw.authorization) || raw.authorization.required !== true) errors.push({ path: '/authorization', message: 'authorization declaration is required' });
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function previewMutation(raw) {
  if (!object(raw) || raw.mode !== 'read-only-preview') return errorEnvelope('mutation_preview', 'CAPABILITY_DENIED', [{ code: 'CAPABILITY_DENIED', message: 'mutation execution is not enabled' }]);
  const validation = validateMutationIntent(raw);
  if (!validation.valid) return errorEnvelope('mutation_preview', 'SCHEMA_INVALID', validation.errors, validation);
  let snapshot;
  try {
    snapshot = {
      target: clone(list(raw.target)),
      expectedDiff: clone(list(raw.expectedDiff)),
      verification: clone(list(raw.verification)),
      recoveryPoint: clone(raw.recoveryPoint),
      authorization: clone(raw.authorization),
    };
  } catch {
    return errorEnvelope('mutation_preview', 'SERIALIZATION_FAILED', [{ code: 'SERIALIZATION_FAILED', path: '/', message: 'intent payload is not serializable for preview' }]);
  }
  const collected = { markers: [], complete: true, stoppedAt: null };
  for (const [field, value] of Object.entries(snapshot)) {
    const part = scanMarkers(value);
    collected.markers.push(...part.markers);
    if (!part.complete && !collected.stoppedAt) collected.stoppedAt = part.stoppedAt;
    collected.complete = collected.complete && part.complete;
  }
  if (collected.markers.length) return errorEnvelope('mutation_preview', 'CAPABILITY_DENIED', collected.markers);
  if (!collected.complete) {
    const { kind, path, limit } = collected.stoppedAt;
    return errorEnvelope('mutation_preview', 'SCAN_INCOMPLETE', [{
      code: 'SCAN_INCOMPLETE',
      path,
      message: `${kind} budget exceeded during capability scan; unscanned content cannot be certified`,
      details: { kind, limit },
    }]);
  }
  return okEnvelope('mutation_preview', {
    execution: 'not performed',
    mode: 'read-only-preview',
    targets: snapshot.target,
    expectedDiff: snapshot.expectedDiff,
    verification: snapshot.verification,
    authorization: snapshot.authorization,
  });
}
