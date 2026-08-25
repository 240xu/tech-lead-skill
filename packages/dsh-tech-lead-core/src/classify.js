/**
 * Task tier classifier (SKILL §1). Pure function.
 *
 * @param {{
 *   touchesMultipleModules?: boolean,
 *   estimatedDays?: number,
 *   irreversibleOps?: string[],
 *   protectedAssetTypes?: Array<'SOURCE'|'USER_DATA'|'CONFIG'|'SECRET'|'RUNTIME'|'GENERATED'>,
 *   publicInterfaceChange?: boolean,
 *   uncertainRisk?: boolean,
 * }} [input]
 * @returns {{ tier: 'T0'|'T1'|'T2', reasons: string[], escalated: boolean }}
 */
export function classify(input = {}) {
  const reasons = [];
  let tier = 'T0';

  const t2 =
    input.touchesMultipleModules === true ||
    (Array.isArray(input.irreversibleOps) && input.irreversibleOps.length > 0) ||
    (Array.isArray(input.protectedAssetTypes) &&
      input.protectedAssetTypes.some((t) =>
        ['USER_DATA', 'SECRET', 'RUNTIME'].includes(t)
      )) ||
    input.publicInterfaceChange === true;

  if (input.touchesMultipleModules) reasons.push('multi-module change → T2');
  if (Array.isArray(input.irreversibleOps) && input.irreversibleOps.length) {
    reasons.push(`irreversible ops (${input.irreversibleOps.join(', ')}) → T2`);
  }
  if (Array.isArray(input.protectedAssetTypes)) {
    for (const t of input.protectedAssetTypes) {
      if (['USER_DATA', 'SECRET', 'RUNTIME'].includes(t)) {
        reasons.push(`protected asset ${t} → T2`);
      }
    }
  }
  if (input.publicInterfaceChange) reasons.push('public interface change → T2');

  const days = Number(input.estimatedDays) || 0;
  if (t2) {
    tier = 'T2';
  } else if (days >= 1) {
    tier = 'T1';
    reasons.push(`estimated ${days}d single-module work → T1`);
  } else {
    reasons.push('trivial, single-file, discardable → T0');
  }

  let escalated = false;
  if (input.uncertainRisk && tier !== 'T2') {
    tier = tier === 'T0' ? 'T1' : 'T2';
    reasons.push('risk uncertain: escalated one tier');
    escalated = true;
  }

  return { tier, reasons, escalated };
}
