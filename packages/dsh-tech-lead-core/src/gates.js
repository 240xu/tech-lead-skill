const roles = ['pm', 'arch', 'eng', 'ops'];
const list = (value) => Array.isArray(value) ? value : [];

export function gatePlan(impact = {}, context = {}) {
  const high = impact.tier === 'T2' || impact.destructive === true || context.tier === 'T2';
  const requiredRoles = high ? roles.slice() : ['eng'];
  return {
    requiredRoles,
    minimumEvidence: high ? 'E3' : 'E2',
    quorum: requiredRoles.length,
    conditions: high ? ['all roles anchored', 'no reject', 'snapshot current'] : ['one anchored reviewer', 'no reject'],
  };
}

export function gateAggregate(reports, plan = {}) {
  const findings = [];
  const seen = new Set();
  const validReports = list(reports).filter((report) => {
    if (!report || !report.role || !Array.isArray(report.anchors) || report.anchors.length === 0) return false;
    for (const item of list(report.findings)) {
      const id = String(item?.id ?? `${report.role}:${item?.message ?? ''}`);
      if (!seen.has(id)) { seen.add(id); findings.push(item); }
    }
    return true;
  });
  const required = list(plan.requiredRoles);
  const missing = required.filter((role) => !validReports.some((report) => report.role === role));
  const rejects = validReports.filter((report) => report.verdict === 'reject');
  const pass = missing.length === 0 && validReports.length >= Number(plan.quorum ?? required.length) && rejects.length === 0;
  const verdict = rejects.length ? 'reject' : pass ? 'pass' : 'conditional';
  return { pass, verdict, findings, missingRoles: missing, unresolved: missing.length > 0 || rejects.length > 0 };
}

export function gateReopen(previous = {}, current = {}) {
  const changedInputs = [];
  if (previous.contextFingerprint !== current.contextFingerprint) changedInputs.push('context');
  if (previous.evidenceFingerprint !== current.evidenceFingerprint) changedInputs.push('evidence');
  if (previous.dependencyFingerprint !== current.dependencyFingerprint) changedInputs.push('dependencies');
  if (previous.impactFingerprint !== current.impactFingerprint) changedInputs.push('impact');
  return { reopen: changedInputs.length > 0, changedInputs, reasons: changedInputs.map((item) => `${item} changed`) };
}
