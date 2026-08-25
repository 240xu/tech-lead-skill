const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const asArray = (value) => Array.isArray(value) ? value : [];
const finding = (code, path, message) => ({ code, path, message });

export function evidenceGraphLint(context) {
  const findings = [];
  const nodes = new Map();
  const collections = ['goalLedger', 'risks', 'decisions', 'gates'];
  for (const collection of collections) {
    for (const [index, item] of asArray(context?.[collection]).entries()) {
      if (!isObject(item) || !String(item.id ?? '').trim()) {
        findings.push(finding('INVALID_LEDGER_ENTRY', `/${collection}/${index}`, 'ledger entry must be an object with a non-empty id'));
        continue;
      }
      const id = String(item.id);
      if (nodes.has(id)) findings.push(finding('DUPLICATE_ID', `/${collection}/${index}/id`, `duplicate id: ${id}`));
      nodes.set(id, { type: collection, item });
    }
  }
  const evidence = asArray(context?.evidence);
  for (const [index, item] of evidence.entries()) {
    if (!isObject(item) || !String(item.id ?? '').trim()) {
      findings.push(finding('INVALID_EVIDENCE', `/evidence/${index}`, 'evidence must have an id'));
      continue;
    }
    const evidenceId = String(item.id);
    if (nodes.has(evidenceId)) findings.push(finding('DUPLICATE_ID', `/evidence/${index}/id`, `duplicate id: ${evidenceId}`));
    nodes.set(evidenceId, { type: 'evidence', item });
  }
  const edges = [];
  const evidenceEdges = new Map();
  for (const [index, item] of evidence.entries()) {
    if (!isObject(item) || !String(item.id ?? '').trim()) continue;
    const evidenceId = String(item.id);
    for (const target of asArray(item.supports)) {
      if (!nodes.has(String(target))) findings.push(finding('UNKNOWN_REFERENCE', `/evidence/${index}/supports`, `unknown reference: ${target}`));
      else {
        const targetId = String(target);
        edges.push({ from: evidenceId, to: targetId, relation: 'supports' });
        if (nodes.get(targetId)?.type === 'evidence') {
          if (!evidenceEdges.has(evidenceId)) evidenceEdges.set(evidenceId, []);
          evidenceEdges.get(evidenceId).push(targetId);
        }
      }
    }
  }
  const color = new Map();
  let hasCycle = false;
  const stack = [];
  for (const start of evidenceEdges.keys()) {
    if (color.get(start)) continue;
    stack.push([start, false]);
    while (stack.length) {
      const [id, processed] = stack.pop();
      if (processed) { color.set(id, 2); continue; }
      const state = color.get(id);
      if (state === 1) { hasCycle = true; continue; }
      if (state === 2) continue;
      color.set(id, 1);
      stack.push([id, true]);
      for (const next of evidenceEdges.get(id) ?? []) {
        if (!color.get(next)) stack.push([next, false]);
        else if (color.get(next) === 1) hasCycle = true;
      }
    }
  }
  if (hasCycle) findings.push(finding('CYCLE', '/evidence', 'evidence graph contains a cycle'));
  return { valid: findings.length === 0, findings, graph: { nodes: [...nodes.keys()], edges } };
}

export function evidenceFreshness(context, options = {}) {
  options = isObject(options) ? options : {};
  const warnings = [];
  const findings = [];
  let ageDays = 7;
  if (options.maxAgeDays !== undefined) {
    const n = Number(options.maxAgeDays);
    if (typeof options.maxAgeDays === 'number' && Number.isFinite(n) && n >= 0) ageDays = n;
    else warnings.push({ code: 'INVALID_MAX_AGE', message: 'maxAgeDays must be a finite number >= 0; using default 7' });
  }
  let now = Date.parse(options.now ?? new Date().toISOString());
  if (!Number.isFinite(now)) {
    warnings.push({ code: 'INVALID_NOW', message: 'using current time because now is not parseable' });
    now = Date.now();
  }
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
