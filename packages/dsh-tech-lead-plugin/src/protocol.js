import { errorEnvelope } from '@240xu/dsh-tech-lead-core';

export function parseJsonString(value, path = 'input') {
  if (typeof value !== 'string') {
    return { ok: false, error: { code: 'BAD_INPUT', path, message: 'expected JSON text string' } };
  }
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    return { ok: false, error: { code: 'BAD_INPUT', path, message: `invalid JSON: ${error.message}` } };
  }
}

export function parseJsonFields(args, fields) {
  const values = {};
  const errors = [];
  for (const field of fields) {
    const result = parseJsonString(args?.[field], field);
    if (result.ok) values[field] = result.value;
    else errors.push(result.error);
  }
  return errors.length ? { ok: false, errors } : { ok: true, values };
}

export function canonicalStringify(value) {
  if (Array.isArray(value)) return value.map(canonicalStringify);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalStringify(value[key])]));
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

const FINDINGS_LIMIT = 500;
const ECHO_LIMIT = 100;
const COMPACT_THRESHOLD = 262144;
const ECHO_KEYS = new Set(['evidence', 'targets', 'expectedDiff', 'verification', 'items']);

export function clampEnvelope(envelope) {
  if (Array.isArray(envelope)) return envelope.length > FINDINGS_LIMIT ? envelope.slice(0, FINDINGS_LIMIT) : envelope;
  if (envelope === null || typeof envelope !== 'object') return envelope;
  const out = { ...envelope };
  let truncatedTotal = 0;
  for (const field of ['errors', 'warnings']) {
    if (Array.isArray(out[field]) && out[field].length > FINDINGS_LIMIT) {
      truncatedTotal = Math.max(truncatedTotal, out[field].length);
      out[field] = out[field].slice(0, FINDINGS_LIMIT);
    }
  }
  if (truncatedTotal > 0) {
    out.warnings = [...(out.warnings ?? []), { code: 'FINDINGS_TRUNCATED', total: truncatedTotal, message: `output truncated to first ${FINDINGS_LIMIT} entries per findings field` }];
  }
  if (out.data !== null && typeof out.data === 'object') {
    const data = { ...out.data };
    for (const key of Object.keys(data)) {
      if (ECHO_KEYS.has(key) && Array.isArray(data[key]) && data[key].length > ECHO_LIMIT) {
        data[key] = { truncated: true, total: data[key].length };
      }
    }
    out.data = data;
  }
  return out;
}

export function renderEnvelope(value) {
  const pretty = JSON.stringify(clampEnvelope(value), null, 2);
  return pretty.length > COMPACT_THRESHOLD ? JSON.stringify(clampEnvelope(value)) : pretty;
}
