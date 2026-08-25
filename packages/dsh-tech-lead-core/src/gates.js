const roles = ['pm', 'arch', 'eng', 'ops'];
const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function gatePlan(impact = {}, context = {}) {
  impact = object(impact) ? impact : {};
  context = object(context) ? context : {};
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
  plan = object(plan) ? plan : {};
  const findings = [];
  const seen = new Set();
  const rolesSeen = new Set();
  const validReports = list(reports).filter((report, index) => {
    if (!object(report) || typeof report.role !== 'string' || !report.role || !Array.isArray(report.anchors) || report.anchors.length === 0) {
      findings.push({ code: 'INVALID_REPORT', path: `/reports/${index}`, message: 'report needs role and anchors' });
      return false;
    }
    if (report.verdict !== 'pass' && report.verdict !== 'reject' && report.verdict !== 'conditional') {
      findings.push({ code: 'INVALID_VERDICT', path: `/reports/${index}/verdict`, message: 'invalid report verdict' });
      return false;
    }
    if (rolesSeen.has(report.role)) {
      findings.push({ code: 'DUPLICATE_ROLE', path: `/reports/${index}/role`, message: `duplicate reviewer role: ${report.role}` });
      return false;
    }
    rolesSeen.add(report.role);
    for (const item of list(report.findings)) {
      const id = String(item?.id ?? `${report.role}:${item?.message ?? ''}`);
      if (!seen.has(id)) { seen.add(id); findings.push(item); }
    }
    return true;
  });
  const required = [...new Set(list(plan.requiredRoles).filter((role) => typeof role === 'string' && role))];
  const quorum = Number.isInteger(plan.quorum) && plan.quorum > 0 ? plan.quorum : required.length;
  if (!required.length || quorum > required.length) findings.push({ code: 'INVALID_PLAN', message: 'plan needs non-empty requiredRoles and a valid quorum' });
  const missing = required.filter((role) => !validReports.some((report) => report.role === role));
  const rejects = validReports.filter((report) => report.verdict === 'reject');
  const conditional = validReports.filter((report) => report.verdict === 'conditional');
  const pass = findings.length === 0 && missing.length === 0 && validReports.length >= quorum && rejects.length === 0 && conditional.length === 0;
  const verdict = rejects.length ? 'reject' : pass ? 'pass' : 'conditional';
  return { pass, verdict, findings, missingRoles: missing, unresolved: missing.length > 0 || rejects.length > 0 || conditional.length > 0 };
}

export function gateReopen(previous = {}, current = {}) {
  previous = object(previous) ? previous : {};
  current = object(current) ? current : {};
  const changedInputs = [];
  if (previous.contextFingerprint !== current.contextFingerprint) changedInputs.push('context');
  if (previous.evidenceFingerprint !== current.evidenceFingerprint) changedInputs.push('evidence');
  if (previous.dependencyFingerprint !== current.dependencyFingerprint) changedInputs.push('dependencies');
  if (previous.impactFingerprint !== current.impactFingerprint) changedInputs.push('impact');
  return { reopen: changedInputs.length > 0, changedInputs, reasons: changedInputs.map((item) => `${item} changed`) };
}
