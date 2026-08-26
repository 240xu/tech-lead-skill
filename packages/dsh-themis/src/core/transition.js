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
    return { allowed: false, reason: `proposed must be one of ${OUTCOMES.join('|')}`, requiredStateChanges: [] };
  }
  if (proposed === 'CONTINUE') {
    return { allowed: true, reason: 'CONTINUE is always available when evidence supports the next step', requiredStateChanges: [] };
  }

  const arr = (k) => (Array.isArray(state?.[k]) ? state[k] : []);
  const decisions = arr('decisions');
  const goalLedger = arr('goal_ledger');
  const risks = arr('risks');
  const done = arr('done');
  const degraded = typeof state?.degraded_reason === 'string' && !!state.degraded_reason.trim();

  if (proposed === 'PIVOT') {
    const changes = [
      { action: 'mark the falsified decision with status "falsified"', doneWhen: 'decisions[] contains an entry with status falsified' },
      { action: 'record the replacement hypothesis or decision', doneWhen: 'decisions[] contains the replacement entry' },
    ];
    return decisions.length > 0
      ? { allowed: true, reason: 'PIVOT requires a falsified recorded decision; decisions ledger present', requiredStateChanges: changes }
      : { allowed: false, reason: 'PIVOT requires at least one recorded decision being falsified (decisions[] empty)', requiredStateChanges: changes };
  }
  if (proposed === 'SCOPE-DOWN') {
    const changes = [
      { action: 'rewrite the affected goal ledger entries with the reduced scope', doneWhen: 'goal_ledger[] reflects the reduced DoD' },
      { action: 'record the driving risks that force the reduction', doneWhen: 'risks[] is non-empty' },
    ];
    return goalLedger.length > 0 && risks.length > 0
      ? { allowed: true, reason: 'SCOPE-DOWN rewrites goal/DoD; ledger and risks present', requiredStateChanges: changes }
      : { allowed: false, reason: 'SCOPE-DOWN requires non-empty goal_ledger[] and risks[]', requiredStateChanges: changes };
  }
  if (proposed === 'STOP') {
    const changes = done.length > 0 || degraded
      ? []
      : [
          { action: 'anchor completed work or record why the effort is degraded', doneWhen: 'done[] has anchored entries or degraded_reason is non-empty' },
        ];
    return done.length > 0 || degraded
      ? { allowed: true, reason: done.length ? 'STOP backed by completed anchored items' : 'STOP justified via degraded_reason', requiredStateChanges: changes }
      : { allowed: false, reason: 'STOP requires achieved anchored items or a degraded_reason justification', requiredStateChanges: changes };
  }
  // PAUSE
  return {
    allowed: true,
    reason: 'PAUSE halts side effects and preserves resume conditions',
    requiredStateChanges: [{ action: 'record resume conditions and the next step before pausing', doneWhen: 'next_step is non-empty' }],
  };
}
