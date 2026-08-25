const MODES = new Set(['PLAN', 'EXECUTE']);
const TIERS = new Set(['T0', 'T1', 'T2']);
const OUTCOMES = new Set(['', 'CONTINUE', 'PAUSE', 'SCOPE-DOWN', 'PIVOT', 'STOP']);
const REPOSITORIES = new Set(['git', 'non-git', 'read-only']);
const FIELDS = new Set([
  'schema', 'project', 'goalLedger', 'nonGoals', 'constraints', 'assets',
  'assumptions', 'decisions', 'risks', 'dependencies', 'evidence', 'gates',
  'current', 'snapshot',
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const field = (errors, path, message) => errors.push({ path, message });

export function validateContext(raw) {
  const errors = [];
  const warnings = [];
  const unknownFields = [];
  if (!isObject(raw)) {
    return { valid: false, errors: [{ path: '/', message: 'context must be an object' }], warnings, unknownFields };
  }
  for (const key of Object.keys(raw)) {
    if (!FIELDS.has(key)) {
      unknownFields.push(key);
      warnings.push({ path: `/${key}`, message: 'unknown field preserved' });
    }
  }
  if (raw.schema !== 'tech-lead.context.v1') field(errors, '/schema', 'must equal tech-lead.context.v1');
  if (!isObject(raw.project)) field(errors, '/project', 'must be an object');
  else {
    for (const key of ['id', 'name']) if (!String(raw.project[key] ?? '').trim()) field(errors, `/project/${key}`, 'must be non-empty');
    if (!REPOSITORIES.has(raw.project.repositoryMode)) field(errors, '/project/repositoryMode', 'invalid repository mode');
  }
  if (!Array.isArray(raw.goalLedger) || raw.goalLedger.length === 0) field(errors, '/goalLedger', 'must contain at least one goal');
  for (const key of ['nonGoals', 'constraints', 'assets', 'assumptions', 'decisions', 'risks', 'dependencies', 'evidence', 'gates']) {
    if (!Array.isArray(raw[key])) field(errors, `/${key}`, 'must be an array');
  }
  if (!isObject(raw.current)) field(errors, '/current', 'must be an object');
  else {
    if (!MODES.has(raw.current.mode)) field(errors, '/current/mode', 'invalid mode');
    if (!TIERS.has(raw.current.tier)) field(errors, '/current/tier', 'invalid tier');
    if (!String(raw.current.phase ?? '').trim()) field(errors, '/current/phase', 'must be non-empty');
    if (!OUTCOMES.has(raw.current.lastOutcome ?? '')) field(errors, '/current/lastOutcome', 'invalid outcome');
    if (!String(raw.current.nextStep ?? '').trim()) field(errors, '/current/nextStep', 'must be non-empty');
  }
  if (!isObject(raw.snapshot)) field(errors, '/snapshot', 'must be an object');
  else {
    if (!String(raw.snapshot.at ?? '').trim()) field(errors, '/snapshot/at', 'must be non-empty');
    if (raw.snapshot.source !== 'inline') field(errors, '/snapshot/source', 'must be inline');
    if (!String(raw.snapshot.fingerprint ?? '').trim()) field(errors, '/snapshot/fingerprint', 'must be non-empty');
  }
  return { valid: errors.length === 0, errors, warnings, unknownFields };
}

export function normalizeContext(raw) {
  if (!isObject(raw)) return { value: raw, warnings: [] };
  const value = structuredClone(raw);
  const warnings = Object.keys(raw)
    .filter((key) => !FIELDS.has(key))
    .map((key) => ({ path: `/${key}`, message: 'unknown field preserved' }));
  return { value, warnings };
}
