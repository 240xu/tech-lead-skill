const LEVELS = ['E0', 'E1', 'E2', 'E3', 'E4'];
const REQUIRED = ['id', 'level', 'source', 'time', 'scope', 'repro'];

/**
 * Evidence provenance lint (SKILL §5). Pure function.
 *
 * @param {unknown} evidence expected array of evidence entries
 * @param {{ highRiskChange?: boolean }} [opts]
 * @returns {Array<{severity:'error'|'warning', path:string, message:string}>}
 */
export function evidenceLint(evidence, opts = {}) {
  if (!Array.isArray(evidence)) {
    return [{ severity: 'error', path: 'evidence', message: 'evidence must be an array' }];
  }
  /** @type {Array<{severity:'error'|'warning', path:string, message:string}>} */
  const f = [];

  evidence.forEach((entry, i) => {
    if (entry === null || typeof entry !== 'object') {
      f.push({ severity: 'error', path: `evidence[${i}]`, message: 'must be an object' });
      return;
    }
    const e = /** @type {Record<string, unknown>} */ (entry);
    for (const field of REQUIRED) {
      const v = e[field];
      if (typeof v !== 'string' || !v.trim()) {
        f.push({ severity: 'error', path: `evidence[${i}].${field}`, message: 'required non-empty string' });
      }
    }
    if (typeof e.level === 'string' && !LEVELS.includes(e.level)) {
      f.push({ severity: 'error', path: `evidence[${i}].level`, message: 'must be one of E0,E1,E2,E3,E4' });
    }
  });

  if (opts.highRiskChange) {
    const maxLevel = evidence.reduce((max, entry) => {
      const lvl = entry && typeof entry === 'object' ? entry.level : undefined;
      return LEVELS.includes(lvl) ? Math.max(max, LEVELS.indexOf(lvl)) : max;
    }, -1);
    if (maxLevel < LEVELS.indexOf('E3')) {
      f.push({
        severity: 'error',
        path: 'evidence',
        message: 'high-risk change requires at least one E3+ evidence (integration/real-process)',
        minimumRequiredLevel: 'E3',
      });
    }
  }

  return f;
}
