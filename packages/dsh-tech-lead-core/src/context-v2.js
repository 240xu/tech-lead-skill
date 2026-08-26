// R8 canonical context v2 + one-way state projection. Pure functions only:
// no writes, no clocks. Identity/fingerprint/source can never be invented.

const V2_TOP = ['schema', 'version', 'project', 'current', 'snapshot', 'state',
  'goalLedger', 'nonGoals', 'constraints', 'decisions', 'risks', 'dependencies',
  'evidence', 'assumptions', 'extensions'];
const PROJECT_KEYS = ['id', 'name', 'repositoryMode'];
const CURRENT_KEYS = ['mode', 'tier', 'phase', 'lastOutcome', 'nextStep'];
const SNAPSHOT_KEYS = ['at', 'source', 'fingerprint'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Validate a tech-lead.context v2 payload.
 * strict: unknown top-level keys (outside `extensions`) are errors.
 * compat: unknown top-level keys are migrated into namespaced `extensions`
 *   (key "migrated:<name>") and surface as EXTENSION_MIGRATED warnings, so
 *   opaque data is never silently dropped by a forward-compatible consumer.
 */
export function validateContextV2(raw, { mode = 'strict' } = {}) {
  const fail = (code, path, message) => ({ valid: false, code, errors: [{ path, message }] });
  if (!isObj(raw)) return fail('SCHEMA_INVALID', '/', 'context v2 must be an object');
  if (raw.schema !== 'tech-lead.context') return fail('UNSUPPORTED_SCHEMA_VERSION', '/schema', 'expected schema "tech-lead.context"');
  if (raw.version !== 2) return fail('UNSUPPORTED_SCHEMA_VERSION', '/version', 'unsupported context version; only 2 is accepted');
  const errors = [];
  const requireObject = (key, keys) => {
    if (!isObj(raw[key])) {
      errors.push({ path: `/${key}`, message: 'must be an object' });
      return false;
    }
    for (const k of keys) {
      if (!(k in raw[key])) errors.push({ path: `/${key}/${k}`, message: 'required field missing' });
    }
    return true;
  };
  const okProject = requireObject('project', PROJECT_KEYS);
  const okCurrent = requireObject('current', CURRENT_KEYS);
  const okSnapshot = requireObject('snapshot', SNAPSHOT_KEYS);
  if (!isObj(raw.state)) errors.push({ path: '/state', message: 'must be an object' });
  for (const key of ['goalLedger', 'nonGoals', 'constraints', 'decisions', 'risks', 'dependencies', 'evidence', 'assumptions']) {
    if (!isArr(raw[key])) errors.push({ path: `/${key}`, message: 'must be an array' });
  }
  if (okProject && !nonEmpty(String(raw.project.id ?? ''))) errors.push({ path: '/project/id', message: 'identity cannot be empty or invented' });
  if (okSnapshot && !nonEmpty(String(raw.snapshot.fingerprint ?? ''))) errors.push({ path: '/snapshot/fingerprint', message: 'fingerprint cannot be empty or invented' });
  if (okSnapshot && !nonEmpty(String(raw.snapshot.source ?? ''))) errors.push({ path: '/snapshot/source', message: 'source provenance required' });

  const unknown = Object.keys(raw).filter((k) => !V2_TOP.includes(k));
  if (unknown.length) {
    if (mode === 'strict') {
      for (const k of unknown) errors.push({ path: `/${k}`, message: 'unknown field; move it under /extensions or drop it (strict mode)' });
    }
  }
  if (errors.length) return { valid: false, code: 'SCHEMA_INVALID', errors };
  const migrated = mode === 'compat' ? unknown : [];
  const warnings = migrated.map((k) => ({
    code: 'EXTENSION_MIGRATED',
    message: `compat: top-level "${k}" preserved under extensions["migrated:${k}"]`,
  }));
  if (mode === 'compat' && isObj(raw.extensions)) {
    for (const k of Object.keys(raw.extensions)) {
      warnings.push({ code: 'EXTENSION_PASSTHROUGH', message: `opaque extension preserved: ${k}` });
    }
  }
  return { valid: true, code: 'OK', warnings, migratedKeys: migrated };
}

/**
 * One-way projection: state.json v1 -> tech-lead.context v2.
 * Returns {ok:true,value,warnings} or {ok:false,code:'NON_CONVERTIBLE_STATE',errors}.
 * Reverse conversion is intentionally NOT implemented here (loss boundary
 * recorded in docs/superpowers/evidence/2026-08-26-r8-projection.md).
 */
export function projectStateToContextV2(state, options = {}) {
  const src = isObj(state) ? state : {};
  const opts = isObj(options) ? options : {};
  // Identity and provenance are never coerced: numbers, objects, or arrays
  // must fail conversion instead of becoming '[object Object]' fingerprints.
  const need = (key) => (typeof opts[key] === 'string' && nonEmpty(opts[key]) ? opts[key] : null);
  const projectId = need('projectId');
  const snapshotFingerprint = need('snapshotFingerprint');
  const missing = [];
  if (!projectId) missing.push('projectId');
  if (!need('projectName')) missing.push('projectName');
  if (!need('snapshotSource')) missing.push('snapshotSource');
  if (!snapshotFingerprint) missing.push('snapshotFingerprint');
  if (!need('at')) missing.push('at');
  if (missing.length) {
    return {
      ok: false,
      code: 'NON_CONVERTIBLE_STATE',
      errors: missing.map((k) => ({ path: `/options/${k}`, message: 'required projection option; identity and provenance are never invented' })),
    };
  }
  const arr = (key) => (isArr(src[key]) ? src[key].slice() : []);
  const value = {
    schema: 'tech-lead.context',
    version: 2,
    project: { id: projectId, name: String(opts.projectName), repositoryMode: String(src.repository_mode ?? '') },
    current: {
      mode: String(src.mode ?? ''), tier: String(src.tier ?? ''), phase: String(src.phase ?? ''),
      lastOutcome: String(src.last_outcome ?? ''), nextStep: String(src.next_step ?? ''),
    },
    snapshot: { at: String(opts.at), source: String(opts.snapshotSource), fingerprint: snapshotFingerprint },
    state: {
      persistence: String(src.state_persistence ?? ''),
      done: arr('done'),
      openGates: arr('open_gates'),
      criticalPath: arr('critical_path'),
      protectedAssets: arr('protected_assets'),
      hypotheses: arr('hypotheses'),
      nextReviewTrigger: String(src.next_review_trigger ?? ''),
      degradedReason: String(src.degraded_reason ?? ''),
      tags: arr('tags'),
    },
    goalLedger: arr('goal_ledger'),
    nonGoals: arr('non_goals'),
    constraints: arr('constraints'),
    decisions: arr('decisions'),
    risks: arr('risks'),
    dependencies: arr('dependencies'),
    evidence: arr('evidence'),
    assumptions: arr('assumptions'),
    extensions: {},
  };
  // Unknown v1 fields survive as opaque namespaced extensions; decision cores ignore them.
  const KNOWN_V1 = new Set(['schema_version', 'mode', 'tier', 'phase', 'repository_mode', 'state_persistence',
    'done', 'evidence', 'open_gates', 'goal_ledger', 'non_goals', 'constraints', 'decisions', 'risks',
    'dependencies', 'critical_path', 'protected_assets', 'hypotheses', 'assumptions', 'tags',
    'last_outcome', 'next_step', 'next_review_trigger', 'degraded_reason', 'updated_at']);
  const warnings = [];
  for (const key of Object.keys(src)) {
    if (!KNOWN_V1.has(key)) {
      value.extensions[key] = src[key];
      warnings.push({ code: 'EXTENSION_MIGRATED', message: `unrecognized state field "${key}" preserved under /extensions` });
    }
  }
  if (isObj(src.gates)) {
    value.extensions['migrated:gates'] = src.gates;
    warnings.push({ code: 'EXTENSION_MIGRATED', message: 'v1 "gates" object has no direct v2 home in the one-way map; preserved under extensions["migrated:gates"]' });
  }
  return { ok: true, value, warnings };
}
