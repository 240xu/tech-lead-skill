import { errorEnvelope, okEnvelope } from '../core/index.js';
import { parseJsonFields, renderEnvelope, runGuarded } from '../protocol.js';

const FINGERPRINT_KEYS = ['contextFingerprint', 'evidenceFingerprint', 'dependencyFingerprint', 'impactFingerprint'];

export function registerGateTools(defineTool, core) {
  const output = [];
  const add = (definition) => output.push(defineTool({ ...definition, output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] } }));
  add({
    name: 'tech_lead_gate_plan',
    description: 'Generate deterministic reviewer roles, evidence minimum, quorum, and gate conditions.',
    parameters: {
      impactJson: { type: 'string', required: true, description: 'change impact object as JSON text ({tier?, destructive?})' },
      contextJson: { type: 'string', required: true, description: 'context snapshot JSON text ({tier?})' },
    },
    async execute(args) {
      return runGuarded('gate_plan', () => {
        const input = parseJsonFields(args ?? {}, ['impactJson', 'contextJson']);
        if (!input.ok) return renderEnvelope(errorEnvelope('gate_plan', 'BAD_INPUT', input.errors));
        const errors = [];
        for (const key of ['impactJson', 'contextJson']) {
          const value = input.values[key];
          if (value === null || typeof value !== 'object' || Array.isArray(value)) errors.push({ code: 'BAD_INPUT', path: key, message: 'expected JSON object' });
        }
        if (errors.length) return renderEnvelope(errorEnvelope('gate_plan', 'BAD_INPUT', errors));
        return renderEnvelope(okEnvelope('gate_plan', core.gatePlan(input.values.impactJson, input.values.contextJson)));
      });
    },
  });
  add({
    name: 'tech_lead_gate_aggregate',
    description: 'Aggregate anchored role reports, propagate rejects, and de-duplicate findings.',
    parameters: {
      reportsJson: { type: 'string', required: true, description: '[{role,verdict(pass|conditional|reject),anchors:[non-empty strings],findings?[]}] as JSON text; one report per role' },
      planJson: { type: 'string', required: true, description: '{requiredRoles:[...],quorum:<positive int>} as JSON text' },
    },
    async execute(args) {
      return runGuarded('gate_aggregate', () => {
        const input = parseJsonFields(args ?? {}, ['reportsJson', 'planJson']);
        if (!input.ok) return renderEnvelope(errorEnvelope('gate_aggregate', 'BAD_INPUT', input.errors));
        const errors = [];
        if (!Array.isArray(input.values.reportsJson)) errors.push({ code: 'BAD_INPUT', path: 'reportsJson', message: 'expected JSON array' });
        const plan = input.values.planJson;
        if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) {
          errors.push({ code: 'BAD_INPUT', path: 'planJson', message: 'expected JSON object' });
        } else if (!Array.isArray(plan.requiredRoles) || plan.requiredRoles.length === 0 || !Number.isInteger(plan.quorum) || plan.quorum <= 0) {
          errors.push({ code: 'BAD_INPUT', path: 'planJson', message: 'plan needs non-empty requiredRoles and a positive integer quorum' });
        }
        if (errors.length) return renderEnvelope(errorEnvelope('gate_aggregate', 'BAD_INPUT', errors));
        const result = core.gateAggregate(input.values.reportsJson, plan);
        if (!result.pass) {
          const conditionalCount = Array.isArray(input.values.reportsJson)
            ? input.values.reportsJson.filter((report) => report && report.verdict === 'conditional').length
            : 0;
          const derived = [
            ...result.missingRoles.map((role) => ({ code: 'MISSING_ROLE', path: `/roles/${role}`, message: `no anchored report from required role "${role}"` })),
            ...(conditionalCount > 0 ? [{ code: 'CONDITIONAL_VERDICT', path: '/reports', message: `${conditionalCount} report(s) hold a conditional verdict` }] : []),
            ...(result.verdict !== 'reject' && result.findings.filter((f) => f.code).length === 0 && Array.isArray(input.values.reportsJson) && input.values.reportsJson.length < plan.quorum
              ? [{ code: 'QUORUM_UNMET', path: '/reports', message: `${input.values.reportsJson.length} of ${plan.quorum} reports present` }]
              : []),
          ];
          return renderEnvelope(errorEnvelope('gate_aggregate', 'GATE_BLOCKED', [...derived, ...result.findings], result));
        }
        return renderEnvelope(okEnvelope('gate_aggregate', result));
      });
    },
  });
  add({
    name: 'tech_lead_gate_reopen',
    description: 'Detect whether a previously passed gate must reopen after snapshot drift.',
    parameters: {
      previousJson: { type: 'string', required: true, description: `object with at least one of: ${FINGERPRINT_KEYS.join(', ')}` },
      currentJson: { type: 'string', required: true, description: `object with at least one of: ${FINGERPRINT_KEYS.join(', ')}` },
    },
    async execute(args) {
      return runGuarded('gate_reopen', () => {
        const input = parseJsonFields(args ?? {}, ['previousJson', 'currentJson']);
        if (!input.ok) return renderEnvelope(errorEnvelope('gate_reopen', 'BAD_INPUT', input.errors));
        const errors = [];
        for (const key of ['previousJson', 'currentJson']) {
          const value = input.values[key];
          const usable = value !== null && typeof value === 'object' && !Array.isArray(value) && FINGERPRINT_KEYS.some((k) => value[k] !== undefined);
          if (!usable) errors.push({ code: 'BAD_INPUT', path: key, message: `expected an object containing at least one of: ${FINGERPRINT_KEYS.join(', ')}` });
        }
        if (errors.length) return renderEnvelope(errorEnvelope('gate_reopen', 'BAD_INPUT', errors));
        const result = core.gateReopen(input.values.previousJson, input.values.currentJson);
        const reasons = result.changedInputs.map((item) => ({ code: `${item.toUpperCase()}_DRIFT`, path: `/${item}Fingerprint`, message: `${item} changed` }));
        return renderEnvelope(result.reopen ? errorEnvelope('gate_reopen', 'DRIFT_DETECTED', reasons, result) : okEnvelope('gate_reopen', result));
      });
    },
  });
  return output;
}
