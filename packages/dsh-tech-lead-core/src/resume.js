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
export function resumeCard(state, opts = {}) {
  const warnings = [];
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
    warnings.push(`open gates pending: ${state.open_gates.join(', ')}`);
  }

  const staleEvidenceIds = [];
  const nowMs = opts.now ? Date.parse(opts.now) : Date.now();
  const maxAgeDays = opts.maxAgeDays ?? 7;
  if (Number.isFinite(nowMs) && Array.isArray(state.evidence)) {
    for (const e of state.evidence) {
      if (!e || typeof e !== 'object') continue;
      const t = Date.parse(String(e.time ?? ''));
      if (Number.isFinite(t) && nowMs - t > maxAgeDays * 86400_000) {
        staleEvidenceIds.push(String(e.id));
      }
    }
  }
  if (staleEvidenceIds.length) {
    warnings.push(`stale evidence (> ${maxAgeDays}d): ${staleEvidenceIds.join(', ')}`);
  }

  return {
    position: `[${tier}] ${phase} · mode=${mode}`,
    lastGate: String(state.last_outcome ?? '') || 'none',
    nextStep,
    staleEvidenceIds,
    warnings,
  };
}
