import { errorEnvelope, makeAction, normalizeGuidance, okEnvelope, parseProtocolOptions } from '../core/index.js';
import { applyProtocol, parseJsonFields, parseJsonString, renderEnvelope, runGuarded } from '../protocol.js';

export function registerContextTools(defineTool, core) {
  const output = [];
  output.push(defineTool({
    name: 'tech_lead_context_validate',
    description: 'Validate an inline tech-lead.context.v1 snapshot. Read-only and deterministic.',
    parameters: { contextJson: { type: 'string', required: true, description: 'context snapshot JSON text' } },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      return runGuarded('context_validate', () => {
        const parsed = parseJsonString(args?.contextJson, 'contextJson', 'graph');
        if (!parsed.ok) return renderEnvelope(applyProtocol(errorEnvelope('context_validate', parsed.error.code, [parsed.error]), args, 'context_validate'));
        const proto = parseProtocolOptions(args?.protocolJson);
        if (!proto.ok) return renderEnvelope(errorEnvelope('context_validate', proto.code, proto.errors));
        const doc = parsed.value;
        const isV2 = doc && typeof doc === 'object' && doc.schema === 'tech-lead.context' && Number(doc.version) === 2;
        const result = isV2
          ? core.validateContextV2(doc, { mode: proto.inputCompatibility === 'compat' ? 'compat' : 'strict' })
          : core.validateContext(doc);
        if (!result.valid) {
          const errors = result.errors.map((item) => ({ code: 'SCHEMA_INVALID', path: item.path, message: item.message }));
          return renderEnvelope(applyProtocol(errorEnvelope('context_validate', 'SCHEMA_INVALID', errors, result), args, 'context_validate'));
        }
        return renderEnvelope(applyProtocol(okEnvelope('context_validate', result), args, 'context_validate'));
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
        const parsed = parseJsonString(args?.contextJson, 'contextJson', 'graph');
        if (!parsed.ok) return renderEnvelope(applyProtocol(errorEnvelope('evidence_graph_lint', parsed.error.code, [parsed.error]), args, 'evidence_graph_lint'));
        const result = core.evidenceGraphLint(parsed.value);
        return renderEnvelope(applyProtocol(result.valid
          ? okEnvelope('evidence_graph_lint', result)
          : errorEnvelope('evidence_graph_lint', 'SCHEMA_INVALID', result.findings, result), args, 'evidence_graph_lint'));

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
        if (!input.ok) return renderEnvelope(applyProtocol(errorEnvelope('evidence_freshness', input.code ?? 'BAD_INPUT', input.errors), args, 'evidence_freshness'));
        let options = {};
        if (args.optionsJson != null && args.optionsJson !== '') {
          const parsedOptions = parseJsonString(args.optionsJson, 'optionsJson');
          if (!parsedOptions.ok) return renderEnvelope(applyProtocol(errorEnvelope('evidence_freshness', parsedOptions.error.code, [parsedOptions.error]), args, 'evidence_freshness'));
          options = parsedOptions.value && typeof parsedOptions.value === 'object' && !Array.isArray(parsedOptions.value) ? parsedOptions.value : {};
        }
        const clockPinned = typeof options.now === 'string' && Number.isFinite(Date.parse(options.now));
        const result = core.evidenceFreshness(input.values.contextJson, options);
        const guidance = result.stale
          ? normalizeGuidance({ mode: 'strict', outcome: 'PAUSE', meaning: 'Evidence is not fresh enough to trust.', actions: result.findings
            .filter((item) => item.refreshAction)
            .map((item) => makeAction({
              kind: 'evidence',
              targetId: item.path.split('/').slice(0, 3).join('/') || 'evidence',
              reasonCodes: [item.code],
              findingRef: item.path,
              action: item.refreshAction.action,
              doneWhen: item.refreshAction.doneWhen,
              nextTool: 'tech_lead_evidence_freshness',
            })) })
          : undefined;
        const data = guidance ? { ...result, guidance } : result;
        const envelope = okEnvelope('evidence_freshness', data, result.warnings);
        envelope.meta.deterministic = clockPinned;
        if (!clockPinned) envelope.meta.clockSource = 'runtime';
        return renderEnvelope(applyProtocol(envelope, args, 'evidence_freshness'));
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
        const parsed = parseJsonString(args?.contextJson, 'contextJson', 'graph');
        if (!parsed.ok) return renderEnvelope(applyProtocol(errorEnvelope('assumption_register', parsed.error.code, [parsed.error]), args, 'assumption_register'));
        const assumptions = Array.isArray(parsed.value?.assumptions) ? parsed.value.assumptions : [];
        const items = assumptions.map((item, index) => ({
          id: item?.id ?? `assumption-${index + 1}`,
          status: typeof item?.verification === 'string' && item.verification.trim() ? 'verifiable' : 'missing_verification',
          verification: item?.verification ?? null,
          affects: Array.isArray(item?.affects) ? item.affects.slice() : [],
        }));
        const enriched = items.map((item) => item.status === 'missing_verification'
          ? { ...item, nextAction: makeAction({
              kind: 'assumption',
              targetId: item.id,
              reasonCodes: ['MISSING_VERIFICATION'],
              findingRef: `/assumptions/${item.id}`,
              action: `Add one deterministic verification method to assumption ${item.id}.`,
              doneWhen: `assumptions entry id ${item.id} has a non-empty verification string`,
            }) }
          : item);
        const missing = enriched.filter((item) => item.status === 'missing_verification');
        const warnings = missing.map((item) => ({
          code: 'MISSING_VERIFICATION',
          path: `/assumptions/${item.id}`,
          message: 'assumption lacks a verification method',
        }));
        return renderEnvelope(applyProtocol(okEnvelope('assumption_register', { items: enriched }, warnings), args, 'assumption_register'));
      });
    },
  }));
  return output;
}
