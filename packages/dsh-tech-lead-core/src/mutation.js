import { errorEnvelope, okEnvelope } from './envelope.js';

const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => JSON.parse(JSON.stringify(value));
const EXECUTABLE_OPERATIONS = new Set(['apply', 'execute', 'deploy']);
const MARKER_PATTERN = /\b(apply|execute|deploy)\b/i;
const scanMarkers = (value, base, depth, errors) => {
  if (depth > 6 || errors.length > 32) return;
  if (typeof value === 'string') {
    if (MARKER_PATTERN.test(value)) errors.push({ path: base, code: 'CAPABILITY_DENIED', message: 'executable marker inside intent payload' });
    return;
  }
  if (Array.isArray(value)) { value.forEach((item, i) => scanMarkers(item, `${base}/${i}`, depth + 1, errors)); return; }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) scanMarkers(value[key], `${base}/${key}`, depth + 1, errors);
  }
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
  const markers = [];
  for (const field of ['target', 'expectedDiff', 'verification', 'recoveryPoint', 'authorization']) scanMarkers(raw[field], `/${field}`, 0, markers);
  if (markers.length) return errorEnvelope('mutation_preview', 'CAPABILITY_DENIED', markers);
  try {
    return okEnvelope('mutation_preview', {
      execution: 'not performed',
      mode: 'read-only-preview',
      targets: clone(list(raw.target)),
      expectedDiff: clone(list(raw.expectedDiff)),
      verification: clone(list(raw.verification)),
      authorization: clone(raw.authorization),
    });
  } catch {
    return errorEnvelope('mutation_preview', 'SERIALIZATION_FAILED', [{ code: 'SERIALIZATION_FAILED', path: '/', message: 'intent payload is not serializable for preview' }]);
  }
}
