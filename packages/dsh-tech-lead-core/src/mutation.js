import { errorEnvelope, okEnvelope } from './envelope.js';

const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateMutationIntent(raw) {
  const errors = [];
  if (!object(raw)) return { valid: false, errors: [{ path: '/', message: 'intent must be an object' }], warnings: [] };
  if (raw.schema !== 'tech-lead.mutation-intent.v1') errors.push({ path: '/schema', message: 'invalid schema' });
  if (raw.mode !== 'read-only-preview') errors.push({ path: '/mode', code: 'CAPABILITY_DENIED', message: 'only read-only-preview is available' });
  if (!list(raw.target).length) errors.push({ path: '/target', message: 'at least one target is required' });
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
  return okEnvelope('mutation_preview', {
    execution: 'not performed',
    mode: 'read-only-preview',
    targets: list(raw.target),
    expectedDiff: list(raw.expectedDiff),
    verification: list(raw.verification),
    authorization: raw.authorization,
  });
}
