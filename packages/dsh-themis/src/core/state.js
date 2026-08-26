/**
 * Machine-checkable validation for tech-lead state.json (schema v1).
 * Pure function: no I/O, throws only on programmer error.
 *
 * @param {unknown} raw parsed JSON value
 * @returns {{
 *   valid: boolean,
 *   errors: Array<{path: string, message: string}>,
 *   warnings: Array<{path: string, message: string}>,
 *   unknownFields: string[],
 * }}
 */
export function validateState(raw) {
  const errors = [];
  const warnings = [];
  const unknownFields = [];

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'state must be a JSON object' }],
      warnings,
      unknownFields,
    };
  }

  const s = /** @type {Record<string, unknown>} */ (raw);

  const KNOWN_FIELDS = new Set([
    'schema_version', 'mode', 'tier', 'phase', 'repository_mode',
    'state_persistence', 'done', 'open_gates', 'goal_ledger', 'constraints',
    'decisions', 'risks', 'dependencies', 'evidence', 'critical_path',
    'protected_assets', 'hypotheses', 'assumptions', 'last_outcome',
    'next_review_trigger', 'degraded_reason', 'tags', 'next_step', 'updated_at',
  ]);
  for (const key of Object.keys(s)) {
    if (!KNOWN_FIELDS.has(key)) unknownFields.push(key);
  }
  for (const key of unknownFields) {
    warnings.push({ path: key, message: 'unknown field preserved (schema v1 does not define it)' });
  }

  // schema_version: number 1 or legacy string "1"
  if (s.schema_version !== 1 && s.schema_version !== '1') {
    errors.push({ path: 'schema_version', message: "must be 1 (number) or \"1\" (legacy)" });
  }

  requireEnum(s, 'mode', ['PLAN', 'EXECUTE'], errors);
  requireEnum(s, 'tier', ['T0', 'T1', 'T2'], errors);
  requireEnum(s, 'repository_mode', ['git', 'non-git', 'read-only'], errors);
  optionalEnum(s, 'state_persistence', ['available', 'unavailable'], errors);
  optionalEnum(s, 'last_outcome',
    ['', 'CONTINUE', 'PAUSE', 'SCOPE-DOWN', 'PIVOT', 'STOP'], errors);

  requireNonEmptyString(s, 'phase', errors);
  requireNonEmptyString(s, 'updated_at', errors);

  // done[]: each entry needs item + non-empty anchor
  if (Array.isArray(s.done)) {
    s.done.forEach((entry, i) => {
      if (entry === null || typeof entry !== 'object') {
        errors.push({ path: `done[${i}]`, message: 'must be an object' });
        return;
      }
      const e = /** @type {Record<string, unknown>} */ (entry);
      if (typeof e.item !== 'string' || !e.item.trim()) {
        errors.push({ path: `done[${i}].item`, message: 'required non-empty string' });
      }
      if (typeof e.anchor !== 'string' || !e.anchor.trim()) {
        errors.push({ path: `done[${i}].anchor`, message: 'required non-empty anchor (commit/tag/file:line)' });
      }
    });
  } else if (s.done !== undefined) {
    errors.push({ path: 'done', message: 'must be an array' });
  }

  // evidence[]: full provenance + bounded level
  if (Array.isArray(s.evidence)) {
    const LEVELS = new Set(['E0', 'E1', 'E2', 'E3', 'E4']);
    const REQUIRED = ['id', 'level', 'source', 'time', 'scope', 'repro'];
    s.evidence.forEach((entry, i) => {
      if (entry === null || typeof entry !== 'object') {
        errors.push({ path: `evidence[${i}]`, message: 'must be an object' });
        return;
      }
      const e = /** @type {Record<string, unknown>} */ (entry);
      for (const field of REQUIRED) {
        const v = e[field];
        if (typeof v !== 'string' || !v.trim()) {
          errors.push({ path: `evidence[${i}].${field}`, message: 'required non-empty string' });
        }
      }
      if (typeof e.level === 'string' && !LEVELS.has(e.level)) {
        errors.push({ path: `evidence[${i}].level`, message: 'must be one of E0,E1,E2,E3,E4' });
      }
    });
  } else if (s.evidence !== undefined) {
    errors.push({ path: 'evidence', message: 'must be an array' });
  }

  return { valid: errors.length === 0, errors, warnings, unknownFields };
}

function requireEnum(obj, key, values, errors) {
  const v = obj[key];
  if (!values.includes(v)) {
    errors.push({ path: key, message: `must be one of ${values.join('|')}` });
  }
}

function optionalEnum(obj, key, values, errors) {
  const v = obj[key];
  if (v !== undefined && !values.includes(v)) {
    errors.push({ path: key, message: `must be one of ${values.join('|')} (or omitted)` });
  }
}

function requireNonEmptyString(obj, key, errors) {
  const v = obj[key];
  if (typeof v !== 'string' || !v.trim()) {
    errors.push({ path: key, message: 'required non-empty string' });
  }
}
