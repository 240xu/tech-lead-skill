const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const asArray = (value) => Array.isArray(value) ? value : [];
const finding = (code, path, message) => ({ code, path, message });

export function evidenceGraphLint(context) {
  const findings = [];
  const nodes = new Map();
  const collections = ['goalLedger', 'risks', 'decisions', 'gates'];
  for (const collection of collections) {
    for (const [index, item] of asArray(context?.[collection]).entries()) {
      if (!isObject(item) || !String(item.id ?? '').trim()) continue;
      const id = String(item.id);
      if (nodes.has(id)) findings.push(finding('DUPLICATE_ID', `/${collection}/${index}/id`, `duplicate id: ${id}`));
      nodes.set(id, { type: collection, item });
    }
  }
  const edges = [];
  for (const [index, item] of asArray(context?.evidence).entries()) {
    if (!isObject(item) || !String(item.id ?? '').trim()) {
      findings.push(finding('INVALID_EVIDENCE', `/evidence/${index}`, 'evidence must have an id'));
      continue;
    }
    const evidenceId = String(item.id);
    if (nodes.has(evidenceId)) findings.push(finding('DUPLICATE_ID', `/evidence/${index}/id`, `duplicate id: ${evidenceId}`));
    nodes.set(evidenceId, { type: 'evidence', item });
    for (const target of asArray(item.supports)) {
      if (!nodes.has(String(target))) findings.push(finding('UNKNOWN_REFERENCE', `/evidence/${index}/supports`, `unknown reference: ${target}`));
      else edges.push({ from: evidenceId, to: String(target), relation: 'supports' });
    }
  }
  return { valid: findings.length === 0, findings, graph: { nodes: [...nodes.keys()], edges } };
}

export function evidenceFreshness(context, options = {}) {
  const warnings = [];
  const findings = [];
  const maxAge = Number(options.maxAgeDays);
  const ageDays = Number.isFinite(maxAge) && maxAge >= 0 ? maxAge : 7;
  if (ageDays !== maxAge) warnings.push({ code: 'INVALID_MAX_AGE', message: 'using default maxAgeDays=7' });
  const now = Date.parse(options.now ?? new Date().toISOString());
  for (const [index, item] of asArray(context?.evidence).entries()) {
    const time = Date.parse(item?.time);
    if (!Number.isFinite(time)) {
      findings.push(finding('INVALID_EVIDENCE_TIME', `/evidence/${index}/time`, 'time is not parseable'));
      continue;
    }
    if (time > now) findings.push(finding('FUTURE_EVIDENCE', `/evidence/${index}/time`, 'evidence time is in the future'));
    if (now - time > ageDays * 86400000) findings.push(finding('STALE_EVIDENCE', `/evidence/${index}`, 'evidence exceeds freshness window'));
    if (options.fingerprint != null && item.fingerprint != null && item.fingerprint !== options.fingerprint) {
      findings.push(finding('FINGERPRINT_DRIFT', `/evidence/${index}/fingerprint`, 'evidence fingerprint differs from current snapshot'));
    }
  }
  return { stale: findings.some((item) => item.code === 'STALE_EVIDENCE' || item.code === 'FINGERPRINT_DRIFT'), findings, warnings, evidence: asArray(context?.evidence) };
}
