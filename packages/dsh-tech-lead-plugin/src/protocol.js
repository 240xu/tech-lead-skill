import { envelopeToV2, errorEnvelope, okEnvelope, parseBoundedJson, parseProtocolOptions } from '@240xu/dsh-tech-lead-core';

export { inspectBounded, parseBoundedJson, getBudgetProfile } from '@240xu/dsh-tech-lead-core';

/**
 * R8 negotiation: every strengthened adapter funnels its finished envelope
 * through here. Selections: default/v2 (label upgrade + complete flag),
 * tech-lead.result.v1 (label downgrade), legacy (bare domain payload).
 */
export function applyProtocol(payload, args, operation, { defaultSelection = 'tech-lead.result.v2' } = {}) {
  const n = parseProtocolOptions(args?.protocolJson);
  if (!n.ok) return errorEnvelope(operation, n.code, n.errors);
  const selection = n.outputProtocol === 'default' ? defaultSelection : n.outputProtocol;
  // Legacy selection always yields the untouched domain payload.
  if (selection === 'legacy') return payload && payload.meta ? payload.data : payload;
  // Bare domain payloads get wrapped when an envelope protocol is selected.
  let envelope = payload;
  if (!payload || typeof payload !== 'object' || !payload.meta) {
    envelope = okEnvelope(operation, payload ?? null);
  }
  if (selection === 'tech-lead.result.v1') {
    return { ...envelope, meta: { ...envelope.meta, outputProtocol: selection, schema: 'tech-lead.result.v1' } };
  }
  const v2 = envelopeToV2(envelope);
  return { ...v2, meta: { ...v2.meta, outputProtocol: 'tech-lead.result.v2' } };
}

const BUDGET_CODES = new Set(['INPUT_TOO_LARGE', 'ITEM_LIMIT_EXCEEDED', 'SCAN_INCOMPLETE']);

export function parseJsonString(value, path = 'input', profileName = 'default') {
  const result = parseBoundedJson(path, value, profileName);
  return result.ok ? result : { ok: false, error: result.error };
}

function promoteCode(errors) {
  return errors.find((item) => BUDGET_CODES.has(item.code))?.code ?? 'BAD_INPUT';
}

export function parseJsonFields(args, fields) {
  const values = {};
  const errors = [];
  for (const field of fields) {
    const result = parseJsonString(args?.[field], field);
    if (result.ok) values[field] = result.value;
    else errors.push(result.error);
  }
  return errors.length ? { ok: false, code: promoteCode(errors), errors } : { ok: true, values };
}

const FINDINGS_LIMIT = 500;
const ECHO_LIMIT = 100;
const RESULT_ARRAY_LIMIT = 1000;
const WALK_DEPTH_LIMIT = 64;
const COMPACT_THRESHOLD = 262144;
const ECHO_KEYS = new Set(['evidence', 'targets', 'expectedDiff', 'verification', 'items']);

export function clampEnvelope(envelope) {
  if (Array.isArray(envelope)) return envelope.length > FINDINGS_LIMIT ? envelope.slice(0, FINDINGS_LIMIT) : envelope;
  if (envelope === null || typeof envelope !== 'object') return envelope;
  const out = { ...envelope };
  // First observed truncation wins; metadata lands ONLY in meta so pinned
  // domain shapes and echo-collapse objects stay byte-identical.
  let truncation = null;
  const note = (kind, observed, limit, path = '/') => {
    if (!truncation) truncation = { kind, observed, limit, path };
  };
  let truncatedTotal = 0;
  for (const field of ['errors', 'warnings']) {
    if (Array.isArray(out[field]) && out[field].length > FINDINGS_LIMIT) {
      note(field, out[field].length, FINDINGS_LIMIT, `/${field}`);
      truncatedTotal = Math.max(truncatedTotal, out[field].length);
      out[field] = out[field].slice(0, FINDINGS_LIMIT);
    }
  }
  if (truncatedTotal > 0) {
    out.warnings = [...(out.warnings ?? []), { code: 'FINDINGS_TRUNCATED', total: truncatedTotal, message: `output truncated to first ${FINDINGS_LIMIT} entries per findings field` }];
  }
  if (out.data !== null && typeof out.data === 'object') {
    out.data = clampNode(out.data, 0, note);
  }
  if (truncation) {
    out.meta = { ...(out.meta ?? {}), complete: false, truncation };
  }
  return out;
}

// Iterative walk with a hard depth cap: subtrees deeper than WALK_DEPTH_LIMIT are
// passed through untouched (native JSON serialization handles arbitrary depth),
// so hostile nesting can no longer turn the renderer into an INTERNAL error.
function clampNode(root, rootDepth, note) {
  const result = Array.isArray(root) ? [...root] : { ...root };
  const stack = [[result, rootDepth]];
  while (stack.length) {
    const [node, depth] = stack.pop();
    const entries = Object.keys(node);
    for (const key of entries) {
      const value = node[key];
      if (!value || typeof value !== 'object') continue;
      if (depth + 1 > WALK_DEPTH_LIMIT) {
        node[key] = { truncated: true, reason: 'DEPTH_LIMIT', depth: WALK_DEPTH_LIMIT };
        continue;
      }
      if (Array.isArray(value)) {
        if (ECHO_KEYS.has(key) && value.length > ECHO_LIMIT) {
          note(`echo:${key}`, value.length, ECHO_LIMIT, key);
          node[key] = { truncated: true, total: value.length };
        } else if (value.length > RESULT_ARRAY_LIMIT) {
          note('array', value.length, RESULT_ARRAY_LIMIT, key);
          node[key] = value.slice(0, RESULT_ARRAY_LIMIT);
        } else {
          node[key] = [...value];
          stack.push([node[key], depth + 1]);
        }
      } else {
        node[key] = { ...value };
        stack.push([node[key], depth + 1]);
      }
    }
  }
  return result;
}

export function canonicalStringify(value) {
  return canonicalize(value, 0);
}

function canonicalize(value, depth) {
  if (depth > WALK_DEPTH_LIMIT) return null; // deep subtrees compare as equal; drift beyond the cap is unreported by design
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, depth + 1));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key], depth + 1)]));
  }
  return value;
}

export function runGuarded(operation, fn) {
  try {
    return fn();
  } catch (error) {
    return JSON.stringify(
      errorEnvelope(operation, 'INTERNAL', [{ code: 'INTERNAL', message: `${error?.name ?? 'Error'}: unexpected internal failure` }]),
      null,
      2,
    );
  }
}

export function csv(value) {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function renderEnvelope(value) {
  const clamped = clampEnvelope(value);
  const pretty = JSON.stringify(clamped, null, 2);
  return pretty.length > COMPACT_THRESHOLD ? JSON.stringify(clamped) : pretty;
}
