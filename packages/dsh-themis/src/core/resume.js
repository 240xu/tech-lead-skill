/**
 * Resume card renderer (SKILL §7). Pure function.
 *
 * @param {Record<string, unknown>} state validated-ish tech-lead state object
 * @param {{ now?: string, maxAgeDays?: number }} [opts]
 * @returns {{
 *   position: string,
 *   lastGate: string,
 *   nextStep: string,
 *   staleEvidenceIds: string[],
 *   warnings: string[],
 * }}
 */
export function resumeCard(maybeState, maybeOpts = {}) {
  const opts = maybeOpts !== null && typeof maybeOpts === 'object' && !Array.isArray(maybeOpts) ? maybeOpts : {};
  const warnings = [];
  const state = maybeState !== null && typeof maybeState === 'object' ? maybeState : {};
  if (maybeState === null || typeof maybeState !== 'object') {
    warnings.push('state is missing or not an object; card rendered from defaults');
  }
  const tier = String(state.tier ?? '?');
  const phase = String(state.phase ?? '?');
  const mode = String(state.mode ?? '?');

  const nextStep = typeof state.next_step === 'string' && state.next_step.trim()
    ? state.next_step
    : '(empty — set next_step before resuming)';
  if (!(typeof state.next_step === 'string' && state.next_step.trim())) {
    warnings.push('next_step is empty; set it before resuming');
  }

  if (Array.isArray(state.open_gates) && state.open_gates.length) {
    warnings.push(`open gates pending: ${state.open_gates.slice(0, 20).join(', ')}${state.open_gates.length > 20 ? ` …+${state.open_gates.length - 20} more` : ''}`);
  }

  const staleEvidenceIds = [];
  let nowMs = Date.now();
  if (opts.now) {
    const parsed = Date.parse(opts.now);
    if (Number.isFinite(parsed)) nowMs = parsed;
    else warnings.push('opts.now is not a parseable time; using current clock');
  }
  let maxAgeDays = 7;
  if (opts.maxAgeDays !== undefined) {
    const n = Number(opts.maxAgeDays);
    if (typeof opts.maxAgeDays === 'number' && Number.isFinite(n) && n >= 0) maxAgeDays = n;
    else warnings.push('maxAgeDays must be a finite number >= 0; using default 7');
  }
  if (Number.isFinite(nowMs) && Array.isArray(state.evidence)) {
    for (const e of state.evidence) {
      if (!e || typeof e !== 'object') continue;
      const t = Date.parse(String(e.time ?? ''));
      if (!Number.isFinite(t)) {
        warnings.push(`evidence ${String(e.id ?? '?')} has unparseable time; excluded from staleness check`);
        continue;
      }
      if (t > nowMs || nowMs - t > maxAgeDays * 86400_000) {
        staleEvidenceIds.push(String(e.id));
      }
    }
  }
  if (staleEvidenceIds.length) {
    warnings.push(`stale evidence (> ${maxAgeDays}d): ${staleEvidenceIds.slice(0, 20).join(', ')}${staleEvidenceIds.length > 20 ? ` …+${staleEvidenceIds.length - 20} more` : ''}`);
  }

  return {
    position: `[${tier}] ${phase} · mode=${mode}`,
    lastGate: String(state.last_outcome ?? '') || 'none',
    nextStep,
    staleEvidenceIds,
    warnings,
  };
}
