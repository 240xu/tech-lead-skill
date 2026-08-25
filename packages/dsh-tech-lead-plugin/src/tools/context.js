import { errorEnvelope, okEnvelope } from '@240xu/dsh-tech-lead-core';

const json = (value, path) => {
  if (typeof value !== 'string') return { ok: false, error: { code: 'BAD_INPUT', path, message: 'expected JSON text string' } };
  try { return { ok: true, value: JSON.parse(value) }; }
  catch (error) { return { ok: false, error: { code: 'BAD_INPUT', path, message: `invalid JSON: ${error.message}` } }; }
};
const parseOptions = (value) => value == null || value === '' ? { ok: true, value: {} } : json(value, 'optionsJson');
const render = (value) => JSON.stringify(value, null, 2);

export function registerContextTools(defineTool, core) {
  const output = [];
  output.push(defineTool({
    name: 'tech_lead_context_validate',
    description: 'Validate an inline tech-lead.context.v1 snapshot. Read-only and deterministic.',
    parameters: { contextJson: { type: 'string', required: true, description: 'context snapshot JSON text' } },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      const parsed = json(args.contextJson, 'contextJson');
      if (!parsed.ok) return render(errorEnvelope('context_validate', parsed.error.code, [parsed.error]));
      const result = core.validateContext(parsed.value);
      return render(result.valid
        ? okEnvelope('context_validate', result)
        : errorEnvelope('context_validate', 'SCHEMA_INVALID', result.errors, result));
    },
  }));
  output.push(defineTool({
    name: 'tech_lead_evidence_graph_lint',
    description: 'Check explicit evidence references against context ledgers.',
    parameters: { contextJson: { type: 'string', required: true, description: 'context snapshot JSON text' } },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      const parsed = json(args.contextJson, 'contextJson');
      if (!parsed.ok) return render(errorEnvelope('evidence_graph_lint', parsed.error.code, [parsed.error]));
      const result = core.evidenceGraphLint(parsed.value);
      return render(result.valid
        ? okEnvelope('evidence_graph_lint', result)
        : errorEnvelope('evidence_graph_lint', 'SCHEMA_INVALID', result.findings, result));
    },
  }));
  output.push(defineTool({
    name: 'tech_lead_evidence_freshness',
    description: 'Detect stale evidence and snapshot fingerprint drift.',
    parameters: {
      contextJson: { type: 'string', required: true, description: 'context snapshot JSON text' },
      optionsJson: { type: 'string', description: 'optional freshness options JSON text' },
    },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      const context = json(args.contextJson, 'contextJson');
      if (!context.ok) return render(errorEnvelope('evidence_freshness', context.error.code, [context.error]));
      const options = parseOptions(args.optionsJson);
      if (!options.ok) return render(errorEnvelope('evidence_freshness', options.error.code, [options.error]));
      const result = core.evidenceFreshness(context.value, options.value);
      return render(result.stale
        ? errorEnvelope('evidence_freshness', 'STALE_EVIDENCE', result.findings, result)
        : okEnvelope('evidence_freshness', result, result.warnings));
    },
  }));
  output.push(defineTool({
    name: 'tech_lead_assumption_register',
    description: 'Analyze assumptions and their verification readiness without persisting them.',
    parameters: { contextJson: { type: 'string', required: true, description: 'context snapshot JSON text' } },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      const parsed = json(args.contextJson, 'contextJson');
      if (!parsed.ok) return render(errorEnvelope('assumption_register', parsed.error.code, [parsed.error]));
      const assumptions = Array.isArray(parsed.value?.assumptions) ? parsed.value.assumptions : [];
      const items = assumptions.map((item, index) => ({
        id: item?.id ?? `assumption-${index + 1}`,
        status: item?.verification ? 'verifiable' : 'missing_verification',
        verification: item?.verification ?? null,
        affects: Array.isArray(item?.affects) ? item.affects.slice() : [],
      }));
      const missing = items.filter((item) => item.status === 'missing_verification');
      return render(missing.length
        ? errorEnvelope('assumption_register', 'SCHEMA_INVALID', missing, { items })
        : okEnvelope('assumption_register', { items }));
    },
  }));
  return output;
}
