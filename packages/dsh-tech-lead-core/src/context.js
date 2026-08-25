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
const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
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
    for (const key of ['id', 'name']) if (!nonEmptyString(raw.project[key])) field(errors, `/project/${key}`, 'must be a non-empty string');
    if (!REPOSITORIES.has(raw.project.repositoryMode)) field(errors, '/project/repositoryMode', 'invalid repository mode');
  }
  if (!Array.isArray(raw.goalLedger) || raw.goalLedger.length === 0) field(errors, '/goalLedger', 'must contain at least one goal');
  else if (!raw.goalLedger.some((goal) => isObject(goal) && nonEmptyString(goal.id) && nonEmptyString(goal.goal))) field(errors, '/goalLedger', 'must contain a goal with string id and goal');
  for (const key of ['nonGoals', 'constraints', 'assets', 'assumptions', 'decisions', 'risks', 'dependencies', 'evidence', 'gates']) {
    if (!Array.isArray(raw[key])) field(errors, `/${key}`, 'must be an array');
  }
  if (!isObject(raw.current)) field(errors, '/current', 'must be an object');
  else {
    if (!MODES.has(raw.current.mode)) field(errors, '/current/mode', 'invalid mode');
    if (!TIERS.has(raw.current.tier)) field(errors, '/current/tier', 'invalid tier');
    if (!nonEmptyString(raw.current.phase)) field(errors, '/current/phase', 'must be a non-empty string');
    if (!OUTCOMES.has(raw.current.lastOutcome ?? '')) field(errors, '/current/lastOutcome', 'invalid outcome');
    if (!nonEmptyString(raw.current.nextStep)) field(errors, '/current/nextStep', 'must be a non-empty string');
  }
  if (!isObject(raw.snapshot)) field(errors, '/snapshot', 'must be an object');
  else {
    if (!nonEmptyString(raw.snapshot.at)) field(errors, '/snapshot/at', 'must be a non-empty string');
    if (raw.snapshot.source !== 'inline') field(errors, '/snapshot/source', 'must be inline');
    if (!nonEmptyString(raw.snapshot.fingerprint)) field(errors, '/snapshot/fingerprint', 'must be a non-empty string');
  }
  return { valid: errors.length === 0, errors, warnings, unknownFields };
}

export function normalizeContext(raw) {
  if (!isObject(raw)) return { value: raw, warnings: [] };
  const value = JSON.parse(JSON.stringify(raw));
  const warnings = Object.keys(raw)
    .filter((key) => !FIELDS.has(key))
    .map((key) => ({ path: `/${key}`, message: 'unknown field preserved' }));
  return { value, warnings };
}
