// R6 bounded-input contracts. Pure functions only: no I/O, no clocks.
// Budgets are fail-closed — any exhaustion returns an inspection result that
// callers must surface as a non-success envelope instead of a partial answer.

const BASE = { bytes: 262144, items: 2000, keys: 200, nodes: 10000, depth: 24 };

const PROFILES = {
  default: { ...BASE },
  state: { ...BASE, bytes: 524288, items: 8000, keys: 300, nodes: 30000, depth: 32 },
  graph: { ...BASE, bytes: 1048576, items: 30000, keys: 64, nodes: 150000 },
  release: { ...BASE, bytes: 1048576, items: 5000, keys: 64, nodes: 40000, depth: 16 },
  mutation: { bytes: 262144, items: 1000, keys: 100, nodes: 8000, depth: 24 },
};

export function getBudgetProfile(name) {
  return { ...(PROFILES[name] ?? PROFILES.default) };
}

function stop(kind, code, path, limit, extra = {}) {
  return {
    complete: false,
    stoppedAt: { kind, path, limit, ...extra },
    code,
  };
}

/**
 * Iteratively walk a parsed JSON value under a budget profile.
 * Returns {complete:true, nodes, maxDepth} or
 * {complete:false, stoppedAt:{kind,path,limit}, code}.
 */
export function inspectBounded(value, profile) {
  const cap = (kind) => profile[kind];
  let nodes = 0;
  let maxDepth = 0;
  const stack = [[value, '', 0]];
  while (stack.length) {
    const [node, path, depth] = stack.pop();
    if (node === null || typeof node !== 'object') continue;
    nodes += 1;
    if (depth > maxDepth) maxDepth = depth;
    if (depth > cap('depth')) return stop('depth', 'SCAN_INCOMPLETE', path || '/', cap('depth'));
    if (nodes > cap('nodes')) return stop('nodes', 'SCAN_INCOMPLETE', path || '/', cap('nodes'));
    if (Array.isArray(node)) {
      if (node.length > cap('items')) return stop('items', 'ITEM_LIMIT_EXCEEDED', path || '/', cap('items'), { observed: node.length });
      for (let i = node.length - 1; i >= 0; i -= 1) stack.push([node[i], `${path}/${i}`, depth + 1]);
    } else {
      const keys = Object.keys(node);
      if (keys.length > cap('keys')) return stop('keys', 'ITEM_LIMIT_EXCEEDED', path || '/', cap('keys'), { observed: keys.length });
      for (let i = keys.length - 1; i >= 0; i -= 1) stack.push([node[keys[i]], `${path}/${keys[i]}`, depth + 1]);
    }
  }
  return { complete: true, nodes, maxDepth };
}

/**
 * Parse a JSON text field under a named budget profile.
 * Success: {ok:true, value, inspection:{complete,nodes,maxDepth}}.
 * Failure: {ok:false, error:{code,path,message,details?}} — codes:
 *   BAD_INPUT (non-string or unparseable), INPUT_TOO_LARGE,
 *   ITEM_LIMIT_EXCEEDED, SCAN_INCOMPLETE.
 */
export function parseBoundedJson(fieldName, value, profileName = 'default') {
  const profile = getBudgetProfile(profileName);
  const fail = (code, message, details) => ({ ok: false, error: { code, path: fieldName, message, details } });
  if (typeof value !== 'string') return fail('BAD_INPUT', 'expected JSON text string');
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes > profile.bytes) {
    return fail('INPUT_TOO_LARGE', `JSON text exceeds ${profile.bytes} byte budget`, { kind: 'bytes', limit: profile.bytes, observed: bytes });
  }
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    return fail('BAD_INPUT', `invalid JSON: ${error.message}`);
  }
  const inspection = inspectBounded(parsed, profile);
  if (!inspection.complete) {
    const { kind, path, limit, ...rest } = inspection.stoppedAt;
    return fail(inspection.code, `${kind} budget exceeded at ${path || '/'}`, { kind, path, limit, ...rest });
  }
  return { ok: true, value: parsed, inspection: { complete: true, nodes: inspection.nodes, maxDepth: inspection.maxDepth } };
}
