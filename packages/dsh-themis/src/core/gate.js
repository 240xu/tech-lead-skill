const VERDICTS = new Set(['pass', 'conditional', 'reject']);

/**
 * Gate precheck (SKILL §5 referee separation + §6 blind protocol), mechanical
 * subset. Pure function.
 *
 * @param {{
 *   proposalAuthorId?: string,
 *   executorId?: string,
 *   reviewerIds?: string[],
 *   solo?: boolean,
 *   blindRequired?: boolean,
 *   destructiveScope?: string[],
 *   reports?: Array<{reviewerId?: string, verdict?: string, anchors?: unknown[]}>,
 * }} input
 * @returns {{ pass: boolean, violations: Array<{type:string, detail:string}> }}
 */
export function gatePrecheck(input = {}) {
  if (input === null || typeof input !== 'object') {
    return { pass: false, violations: [{ type: 'BAD_INPUT', detail: 'gate precheck input must be an object' }] };
  }
  const reviewerIds = Array.isArray(input.reviewerIds) ? input.reviewerIds : [];
  const malformedReports = input.reports !== undefined && !Array.isArray(input.reports);
  const reports = malformedReports ? [] : Array.isArray(input.reports) ? input.reports : [];
  /** @type {Array<{type:string, detail:string}>} */
  const v = [];
  if (malformedReports) {
    // Fail closed: supplied-but-malformed review data can never count as "no reviews".
    v.push({ type: 'BAD_REPORTS', detail: 'reports must be an array when provided' });
  }

  if (input.proposalAuthorId && input.proposalAuthorId === input.executorId) {
    v.push({ type: 'PROPOSER_IS_EXECUTOR', detail: 'referee separation requires proposalAuthorId != executorId' });
  }

  for (const who of ['proposalAuthorId', 'executorId']) {
    const id = input[who];
    if (id && reviewerIds.includes(id)) {
      v.push({ type: 'IDENTITY_OVERLAP', detail: `${who} "${id}" may not also review` });
    }
  }

  for (const [i, r] of reports.entries()) {
    if (r === null || typeof r !== 'object') {
      v.push({ type: 'BAD_REPORT', detail: `report[${i}] must be an object` });
      continue;
    }
    if (!VERDICTS.has(r.verdict)) {
      v.push({ type: 'BAD_VERDICT', detail: `report[${i}] verdict must be pass|conditional|reject` });
    }
    const anchors = Array.isArray(r.anchors) ? r.anchors.filter((a) => typeof a === 'string' && a.trim()) : [];
    if (anchors.length === 0) {
      v.push({ type: 'ANCHOR_MISSING', detail: `report[${i}] needs at least one file:line or command anchor` });
    }
  }

  const destructiveScope = Array.isArray(input.destructiveScope) ? input.destructiveScope : [];
  if (input.destructiveScope !== undefined && !Array.isArray(input.destructiveScope)) {
    v.push({ type: 'BAD_DESTRUCTIVE_SCOPE', detail: 'destructiveScope must be an array of strings when provided' });
  }
  if (input.solo && destructiveScope.length > 0) {
    v.push({
      type: 'SOLO_FORBIDDEN',
      detail: `solo:true cannot clear destructive scope (${destructiveScope.slice(0, 8).join(', ')}${destructiveScope.length > 8 ? ' …' : ''})`,
    });
  }

  if (input.blindRequired) {
    const distinctAnchored = new Set(
      reports
        .filter((r) => VERDICTS.has(r.verdict) &&
          Array.isArray(r.anchors) && r.anchors.some((a) => typeof a === 'string' && a.trim()))
        .map((r) => r.reviewerId)
    ).size;
    if (distinctAnchored < 3) {
      v.push({ type: 'BLIND_QUORUM', detail: `blind gate needs ≥3 distinct anchored reviewers, got ${distinctAnchored}` });
    }
  }

  return { pass: v.length === 0, violations: v };
}
