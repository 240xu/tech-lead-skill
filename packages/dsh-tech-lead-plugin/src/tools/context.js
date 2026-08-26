import { errorEnvelope, okEnvelope } from '@240xu/dsh-tech-lead-core';
import { parseJsonFields, parseJsonString, renderEnvelope, runGuarded } from '../protocol.js';

export function registerContextTools(defineTool, core) {
  const output = [];
  output.push(defineTool({
    name: 'tech_lead_context_validate',
    description: 'Validate an inline tech-lead.context.v1 snapshot. Read-only and deterministic.',
    parameters: { contextJson: { type: 'string', required: true, description: 'context snapshot JSON text' } },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      return runGuarded('context_validate', () => {
        const parsed = parseJsonString(args?.contextJson, 'contextJson');
        if (!parsed.ok) return renderEnvelope(errorEnvelope('context_validate', parsed.error.code, [parsed.error]));
        const result = core.validateContext(parsed.value);
        if (!result.valid) {
          const errors = result.errors.map((item) => ({ code: 'SCHEMA_INVALID', path: item.path, message: item.message }));
          return renderEnvelope(errorEnvelope('context_validate', 'SCHEMA_INVALID', errors, result));
        }
        return renderEnvelope(okEnvelope('context_validate', result));
      });
    },
  }));
  output.push(defineTool({
    name: 'tech_lead_evidence_graph_lint',
    description: 'Check explicit evidence references against context ledgers.',
    parameters: { contextJson: { type: 'string', required: true, description: 'context snapshot JSON text' } },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      return runGuarded('evidence_graph_lint', () => {
        const parsed = parseJsonString(args?.contextJson, 'contextJson');
        if (!parsed.ok) return renderEnvelope(errorEnvelope('evidence_graph_lint', parsed.error.code, [parsed.error]));
        const result = core.evidenceGraphLint(parsed.value);
        return renderEnvelope(result.valid
          ? okEnvelope('evidence_graph_lint', result)
          : errorEnvelope('evidence_graph_lint', 'SCHEMA_INVALID', result.findings, result));
      });
    },
  }));
  output.push(defineTool({
    name: 'tech_lead_evidence_freshness',
    description: 'Detect stale evidence and snapshot fingerprint drift.',
    parameters: {
      contextJson: { type: 'string', required: true, description: 'context snapshot JSON text' },
      optionsJson: { type: 'string', description: 'optional freshness options JSON text (provide now for deterministic runs)' },
    },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      return runGuarded('evidence_freshness', () => {
        const input = parseJsonFields(args ?? {}, ['contextJson']);
        if (!input.ok) return renderEnvelope(errorEnvelope('evidence_freshness', 'BAD_INPUT', input.errors));
        let options = {};
        if (args.optionsJson != null && args.optionsJson !== '') {
          const parsedOptions = parseJsonString(args.optionsJson, 'optionsJson');
          if (!parsedOptions.ok) return renderEnvelope(errorEnvelope('evidence_freshness', parsedOptions.error.code, [parsedOptions.error]));
          options = parsedOptions.value && typeof parsedOptions.value === 'object' && !Array.isArray(parsedOptions.value) ? parsedOptions.value : {};
        }
        const clockPinned = typeof options.now === 'string' && Number.isFinite(Date.parse(options.now));
        const result = core.evidenceFreshness(input.values.contextJson, options);
        const envelope = result.stale
          ? errorEnvelope('evidence_freshness', 'STALE_EVIDENCE', result.findings, result)
          : okEnvelope('evidence_freshness', result, result.warnings);
        envelope.meta.deterministic = clockPinned;
        return renderEnvelope(envelope);
      });
    },
  }));
  output.push(defineTool({
    name: 'tech_lead_assumption_register',
    description: 'Analyze assumptions and their verification readiness without persisting them.',
    parameters: { contextJson: { type: 'string', required: true, description: 'context snapshot JSON text' } },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      return runGuarded('assumption_register', () => {
        const parsed = parseJsonString(args?.contextJson, 'contextJson');
        if (!parsed.ok) return renderEnvelope(errorEnvelope('assumption_register', parsed.error.code, [parsed.error]));
        const assumptions = Array.isArray(parsed.value?.assumptions) ? parsed.value.assumptions : [];
        const items = assumptions.map((item, index) => ({
          id: item?.id ?? `assumption-${index + 1}`,
          status: item?.verification ? 'verifiable' : 'missing_verification',
          verification: item?.verification ?? null,
          affects: Array.isArray(item?.affects) ? item.affects.slice() : [],
        }));
        const missing = items.filter((item) => item.status === 'missing_verification');
        if (missing.length) {
          const errors = missing.map((item) => ({ code: 'MISSING_VERIFICATION', path: `/assumptions/${item.id}`, message: 'assumption lacks a verification method' }));
          return renderEnvelope(errorEnvelope('assumption_register', 'SCHEMA_INVALID', errors, { items }));
        }
        return renderEnvelope(okEnvelope('assumption_register', { items }));
      });
    },
  }));
  return output;
}
