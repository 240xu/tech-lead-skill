/**
 * Plan completeness lint (SKILL §3.1 goal ledger + assumption/decision/risk/
 * dependency contracts). Pure function.
 *
 * @param {Record<string, unknown>} plan
 * @returns {Array<{severity:'error'|'warning', path:string, message:string}>}
 */
export function planLint(plan) {
  if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) {
    return [{ severity: 'error', path: 'plan', message: 'plan must be an object' }];
  }
  /** @type {Array<{severity:'error'|'warning', path:string, message:string}>} */
  const f = [];
  const reqStr = (obj, key) => typeof obj[key] === 'string' && !!obj[key].trim();

  if (!reqStr(plan, 'goal')) {
    f.push({ severity: 'error', path: 'goal', message: 'required non-empty goal' });
  } else {
    if (!reqStr(plan, 'metric')) f.push({ severity: 'error', path: 'metric', message: 'goal needs a measurable metric' });
    if (!reqStr(plan, 'target')) f.push({ severity: 'error', path: 'target', message: 'goal needs a target value' });
  }

  for (const [i, item] of objectItemsOrGap(plan.assumptions, 'assumptions', f)) {
    if (!reqStr(item, 'verification')) {
      f.push({ severity: 'error', path: `assumptions[${i}].verification`, message: 'assumption needs a verification method' });
    }
  }
  for (const [i, item] of objectItemsOrGap(plan.decisions, 'decisions', f)) {
    if (!hasAlternatives(item)) f.push({ severity: 'error', path: `decisions[${i}].alternatives`, message: 'decision must record rejected alternatives' });
    if (!reqStr(item, 'reason')) f.push({ severity: 'error', path: `decisions[${i}].reason`, message: 'decision must record its reason' });
  }
  for (const [i, item] of objectItemsOrGap(plan.risks, 'risks', f)) {
    if (!reqStr(item, 'impact')) f.push({ severity: 'error', path: `risks[${i}].impact`, message: 'risk needs impact' });
    if (!reqStr(item, 'mitigation')) f.push({ severity: 'error', path: `risks[${i}].mitigation`, message: 'risk needs mitigation' });
  }
  for (const [i, item] of objectItemsOrGap(plan.dependencies, 'dependencies', f)) {
    if (!reqStr(item, 'blocker')) f.push({ severity: 'error', path: `dependencies[${i}].blocker`, message: 'dependency needs its blocking relation / alternative path' });
  }

  const irreversible = Array.isArray(plan.irreversibleOps) ? plan.irreversibleOps : [];
  if (irreversible.length && !reqStr(plan, 'rollback')) {
    f.push({ severity: 'error', path: 'rollback', message: 'irreversible operations require a rollback plan' });
  }

  return f;
}

function objectItemsOrGap(arr, name, findings) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  arr.forEach((item, i) => {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) out.push([i, item]);
    else findings.push({ severity: 'error', path: `${name}[${i}]`, message: 'must be an object ({claim,...}, {choice,...}, {description,...}, {what,...})' });
  });
  return out;
}

function hasAlternatives(item) {
  const a = item.alternatives;
  if (typeof a === 'string') return !!a.trim();
  return Array.isArray(a) && a.length > 0;
}
