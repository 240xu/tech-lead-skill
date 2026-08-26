// R8 result-protocol negotiation. Pure parsing; adapters consume the verdict.

const INPUT_COMPAT = new Set(['strict', 'compat']);
// 'default' lets each adapter keep its documented wire default
// (nine legacy tools -> legacy bare; strengthened tools -> tech-lead.result.v2).
const OUTPUT_PROTOCOLS = new Set(['default', 'legacy', 'tech-lead.result.v1', 'tech-lead.result.v2']);

/**
 * Parse a protocolJson option string.
 * Success: {inputCompatibility, outputProtocol}.
 * Failure: {ok:false, code:'BAD_INPUT'|'UNSUPPORTED_SCHEMA_VERSION', errors:[...]}.
 */
export function parseProtocolOptions(protocolJson) {
  if (protocolJson == null || protocolJson === '') return { ok: true, inputCompatibility: 'strict', outputProtocol: 'default' };
  if (typeof protocolJson !== 'string') {
    return { ok: false, code: 'BAD_INPUT', errors: [{ code: 'BAD_INPUT', path: '/protocolJson', message: 'expected JSON text string' }] };
  }
  let parsed;
  try {
    parsed = JSON.parse(protocolJson);
  } catch (error) {
    return { ok: false, code: 'BAD_INPUT', errors: [{ code: 'BAD_INPUT', path: '/protocolJson', message: `invalid JSON: ${error.message}` }] };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, code: 'BAD_INPUT', errors: [{ code: 'BAD_INPUT', path: '/protocolJson', message: 'expected a JSON object' }] };
  }
  const errors = [];
  const inputCompatibility = parsed.inputCompatibility ?? 'strict';
  const outputProtocol = parsed.outputProtocol ?? 'default';
  if (!INPUT_COMPAT.has(inputCompatibility)) {
    errors.push({ code: 'UNSUPPORTED_SCHEMA_VERSION', path: '/protocolJson/inputCompatibility', message: `inputCompatibility must be one of ${[...INPUT_COMPAT].join('|')}` });
  }
  if (!OUTPUT_PROTOCOLS.has(outputProtocol)) {
    errors.push({ code: 'UNSUPPORTED_SCHEMA_VERSION', path: '/protocolJson/outputProtocol', message: `outputProtocol must be one of ${[...OUTPUT_PROTOCOLS].join('|')}` });
  }
  if (errors.length) return { ok: false, code: 'UNSUPPORTED_SCHEMA_VERSION', errors };
  return { ok: true, inputCompatibility, outputProtocol };
}

/** Upgrade an existing v1 envelope to the v2 wire label. */
export function envelopeToV2(envelope) {
  if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) return envelope;
  const meta = { ...(envelope.meta ?? {}) };
  if (meta.complete === undefined) meta.complete = true;
  meta.schema = 'tech-lead.result.v2';
  return { ...envelope, meta };
}
