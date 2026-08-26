const SCHEMA = 'tech-lead.result.v2';

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
  findings = [],
  guidance = null,
  operation = 'unknown',
  meta = {},
} = {}) {
  return {
    ok: Boolean(ok),
    code,
    data,
    findings: asArray(findings),
    guidance,
    errors: asArray(errors),
    warnings: asArray(warnings),
    meta: {
      ...meta,
      complete: meta.complete ?? true,
      schema: SCHEMA,
      operation,
      deterministic: meta.deterministic === false ? false : true,
      sideEffects: false,
    },
  };
}

export function okEnvelope(operation, data, warnings = [], meta = {}) {
  return makeEnvelope({ ok: true, code: 'OK', data, warnings, operation, meta });
}

export function errorEnvelope(operation, code, errors = [], data = null) {
  return makeEnvelope({ ok: false, code, data, errors, operation });
}
