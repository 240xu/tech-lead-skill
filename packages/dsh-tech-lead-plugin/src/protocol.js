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

export function renderEnvelope(value) {
  return JSON.stringify(value, null, 2);
}
