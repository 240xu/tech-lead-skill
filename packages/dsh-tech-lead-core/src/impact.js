const items = (value) => Array.isArray(value) ? value : [];

export function changeImpact(change = {}, context = {}) {
  change = change !== null && typeof change === 'object' && !Array.isArray(change) ? change : {};
  context = context !== null && typeof context === 'object' && !Array.isArray(context) ? context : {};
  const modules = items(change.modules);
  const assets = items(change.assets);
  const high = Boolean(change.irreversible || change.publicInterface || modules.length >= 2 || assets.some((item) => ['USER_DATA', 'SECRET', 'RUNTIME'].includes(item)));
  const medium = !high && assets.some((item) => ['CONFIG', 'GENERATED'].includes(item));
  const tier = high ? 'T2' : medium ? 'T1' : 'T0';
  const reversible = change.irreversible !== true;
  const reopenGates = high ? items(context.gates).map((gate) => String(gate?.id)).filter(Boolean) : [];
  return { tier, assets, reversible, blastRadius: high ? 'high' : medium ? 'medium' : 'low', reopenGates, reasons: [high ? 'high-impact trigger matched' : medium ? 'single-module or config change' : 'reversible source-only change'] };
}
