const OUTCOMES = ['CONTINUE', 'PAUSE', 'SCOPE-DOWN', 'PIVOT', 'STOP'];

/**
 * Mechanical outcome-transition check (SKILL §4.8 subset). Pure function.
 *
 * @param {Record<string, unknown>} state tech-lead state object
 * @param {string} proposed proposed last_outcome
 * @returns {{ allowed: boolean, reason: string }}
 */
export function transitionCheck(state, proposed) {
  if (!OUTCOMES.includes(proposed)) {
    return { allowed: false, reason: `proposed must be one of ${OUTCOMES.join('|')}` };
  }
  if (proposed === 'CONTINUE') {
    return { allowed: true, reason: 'CONTINUE is always available when evidence supports the next step' };
  }

  const arr = (k) => (Array.isArray(state?.[k]) ? state[k] : []);
  const decisions = arr('decisions');
  const goalLedger = arr('goal_ledger');
  const risks = arr('risks');
  const done = arr('done');
  const degraded = typeof state?.degraded_reason === 'string' && !!state.degraded_reason.trim();

  if (proposed === 'PIVOT') {
    return decisions.length > 0
      ? { allowed: true, reason: 'PIVOT requires a falsified recorded decision; decisions ledger present' }
      : { allowed: false, reason: 'PIVOT requires at least one recorded decision being falsified (decisions[] empty)' };
  }
  if (proposed === 'SCOPE-DOWN') {
    return goalLedger.length > 0 && risks.length > 0
      ? { allowed: true, reason: 'SCOPE-DOWN rewrites goal/DoD; ledger and risks present' }
      : { allowed: false, reason: 'SCOPE-DOWN requires non-empty goal_ledger[] and risks[]' };
  }
  if (proposed === 'STOP') {
    return done.length > 0 || degraded
      ? { allowed: true, reason: done.length ? 'STOP backed by completed anchored items' : 'STOP justified via degraded_reason' }
      : { allowed: false, reason: 'STOP requires achieved anchored items or a degraded_reason justification' };
  }
  // PAUSE
  return { allowed: true, reason: 'PAUSE halts side effects and preserves resume conditions' };
}
