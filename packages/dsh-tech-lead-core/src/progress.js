const list = (value) => Array.isArray(value) ? value : [];
const stableId = (value) => (typeof value?.id === 'string' && value.id.trim() ? String(value.id) : null);

export function progressDecide(context, options = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return {
    outcome: 'PAUSE', allowed: false, reasons: [{ code: 'BAD_INPUT', message: 'context must be an object' }], blockers: [], requiredActions: ['provide context'], confidence: 1,
  };
  options = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  const reasons = [];
  const blockers = [];
  const blockerRefs = { gate: [], dependency: [], evidence: [] };

  list(context.dependencies).forEach((item, index) => {
    if (!(item?.blocker && item.status !== 'done')) return;
    const id = stableId(item);
    if (id) {
      blockers.push(id);
      blockerRefs.dependency.push({ id, path: `/dependencies/${index}` });
    } else {
      reasons.push({ code: 'MISSING_ID', path: `/dependencies/${index}`, id: `missing:dependencies:${index}`, message: 'blocking dependency lacks a stable id' });
    }
  });

  const staleEvidenceIds = [];
  list(context.evidence).forEach((item, index) => {
    if (!item?.stale) return;
    const id = stableId(item);
    if (id) {
      staleEvidenceIds.push(id);
      blockerRefs.evidence.push({ id, path: `/evidence/${index}` });
    } else {
      reasons.push({ code: 'MISSING_ID', path: `/evidence/${index}`, id: `missing:evidence:${index}`, message: 'stale evidence lacks a stable id' });
    }
  });

  const blockingGateIds = [];
  list(context.gates).forEach((item, index) => {
    if (!(item?.destructive && item.status !== 'pass')) return;
    const id = stableId(item);
    if (id) {
      blockingGateIds.push(id);
      blockerRefs.gate.push({ id, path: `/gates/${index}` });
    } else {
      reasons.push({ code: 'MISSING_ID', path: `/gates/${index}`, id: `missing:gates:${index}`, message: 'destructive gate lacks a stable id' });
    }
  });

  if (staleEvidenceIds.length) reasons.push({ code: 'STALE_EVIDENCE', evidence: staleEvidenceIds });
  if (blockers.length) reasons.push({ code: 'DEPENDENCY_BLOCKED', dependencies: blockers });
  if (blockingGateIds.length) reasons.push({ code: 'GATE_BLOCKED', message: 'destructive gate is not passed', gates: blockingGateIds });

  if (staleEvidenceIds.length || blockers.length || blockingGateIds.length) return {
    outcome: 'PAUSE',
    allowed: false,
    reasons,
    blockers,
    requiredActions: blockers.length ? [`resolve blocking dependencies: ${blockers.join(', ')}`] : staleEvidenceIds.length ? [`refresh stale evidence: ${staleEvidenceIds.join(', ')}`] : [`obtain pass verdict for destructive gate(s): ${blockingGateIds.join(', ')}`],
    confidence: 1,
    blockingGateIds,
    blockedDependencyIds: blockers,
    staleEvidenceIds,
    blockerRefs,
  };
  if (options.forcePivot === true) return {
    outcome: 'PIVOT',
    allowed: false,
    reasons: [{ code: 'PIVOT_REQUESTED' }],
    blockers: [],
    requiredActions: ['record the falsified decision and its replacement hypothesis before resuming'],
    confidence: 0.8,
    blockingGateIds: [],
    blockedDependencyIds: [],
    staleEvidenceIds: [],
    blockerRefs,
  };
  return {
    outcome: 'CONTINUE', allowed: true, reasons: [{ code: 'NO_BLOCKER' }], blockers: [], requiredActions: [], confidence: 0.7,
    blockingGateIds: [], blockedDependencyIds: [], staleEvidenceIds: [], blockerRefs,
  };
}
