const SCHEMA = 'tech-lead.result.v1';

const asArray = (value) => {
  if (value == null) return [];
  return Array.isArray(value) ? value.slice() : [value];
};

export function makeEnvelope({
  ok = false,
  code = ok ? 'OK' : 'UNKNOWN_ERROR',
  data = null,
  errors = [],
  warnings = [],
  operation = 'unknown',
  meta = {},
} = {}) {
  return {
    ok: Boolean(ok),
    code,
    data,
    errors: asArray(errors),
    warnings: asArray(warnings),
    meta: {
      schema: SCHEMA,
      operation,
      deterministic: true,
      sideEffects: false,
      ...meta,
    },
  };
}

export function okEnvelope(operation, data, warnings = []) {
  return makeEnvelope({ ok: true, code: 'OK', data, warnings, operation });
}

export function errorEnvelope(operation, code, errors = [], data = null) {
  return makeEnvelope({ ok: false, code, data, errors, operation });
}
