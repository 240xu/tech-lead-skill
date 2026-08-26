const list = (value) => Array.isArray(value) ? value : [];

export function progressDecide(context, options = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return {
    outcome: 'PAUSE', allowed: false, reasons: [{ code: 'BAD_INPUT', message: 'context must be an object' }], blockers: [], requiredActions: ['provide context'], confidence: 1,
  };
  options = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  const blockers = list(context.dependencies).filter((item) => item?.blocker && item.status !== 'done').map((item) => String(item.id ?? 'unknown'));
  const reasons = [];
  const stale = list(context.evidence).filter((item) => item?.stale).map((item) => String(item.id ?? 'unknown'));
  if (stale.length) reasons.push({ code: 'STALE_EVIDENCE', evidence: stale });
  if (blockers.length) reasons.push({ code: 'DEPENDENCY_BLOCKED', dependencies: blockers });
  const destructiveGate = list(context.gates).some((item) => item?.destructive && item.status !== 'pass');
  if (destructiveGate) reasons.push({ code: 'GATE_BLOCKED', message: 'destructive gate is not passed' });
  if (stale.length || blockers.length || destructiveGate) return {
    outcome: 'PAUSE', allowed: false, reasons, blockers, requiredActions: ['resolve blockers and refresh evidence'], confidence: 1,
  };
  if (options.forcePivot === true) return { outcome: 'PIVOT', allowed: false, reasons: [{ code: 'PIVOT_REQUESTED' }], blockers: [], requiredActions: ['record decision'], confidence: 0.8 };
  return { outcome: 'CONTINUE', allowed: true, reasons: [{ code: 'NO_BLOCKER' }], blockers: [], requiredActions: [], confidence: 0.7 };
}
