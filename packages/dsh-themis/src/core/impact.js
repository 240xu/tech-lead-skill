const items = (value) => Array.isArray(value) ? value : [];

export function changeImpact(change = {}, context = {}) {
  change = change !== null && typeof change === 'object' && !Array.isArray(change) ? change : {};
  context = context !== null && typeof context === 'object' && !Array.isArray(context) ? context : {};
  const modules = items(change.modules);
  const assets = items(change.assets);
  const irreversible = Boolean(change.irreversible);
  const high = irreversible || Boolean(change.publicInterface) || modules.length >= 2 || assets.some((item) => ['USER_DATA', 'SECRET', 'RUNTIME'].includes(item));
  const medium = !high && assets.some((item) => ['CONFIG', 'GENERATED'].includes(item));
  const tier = high ? 'T2' : medium ? 'T1' : 'T0';
  const reversible = !irreversible;
  const reopenGates = high ? items(context.gates).map((gate) => String(gate?.id)).filter(Boolean) : [];
  const triggeredBy = [];
  if (irreversible) triggeredBy.push({ rule: 'IRREVERSIBLE', sourcePath: '/irreversible', effect: 'T2' });
  if (change.publicInterface) triggeredBy.push({ rule: 'PUBLIC_INTERFACE', sourcePath: '/publicInterface', effect: 'T2' });
  if (modules.length >= 2) triggeredBy.push({ rule: 'MULTI_MODULE', sourcePath: '/modules', effect: 'T2' });
  if (assets.some((item) => ['USER_DATA', 'SECRET', 'RUNTIME'].includes(item))) triggeredBy.push({ rule: 'PROTECTED_ASSET', sourcePath: '/assets', effect: 'T2' });
  if (!high && medium) triggeredBy.push({ rule: 'CONFIG_OR_GENERATED_ASSET', sourcePath: '/assets', effect: 'T1' });
  const gateActions = high
    ? reopenGates.map((gateId) => ({ gateId, action: 'reopen', reason: 'high-impact trigger matched' }))
    : [];
  return { tier, assets, reversible, blastRadius: high ? 'high' : medium ? 'medium' : 'low', reopenGates, triggeredBy, gateActions, reasons: [high ? 'high-impact trigger matched' : medium ? 'single-module or config change' : 'reversible source-only change'] };
}
