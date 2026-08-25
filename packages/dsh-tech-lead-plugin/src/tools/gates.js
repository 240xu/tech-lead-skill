import { errorEnvelope, okEnvelope } from '@240xu/dsh-tech-lead-core';
import { parseJsonFields, renderEnvelope, runGuarded } from '../protocol.js';

export function registerGateTools(defineTool, core) {
  const output = [];
  const add = (definition) => output.push(defineTool({ ...definition, output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] } }));
  add({
    name: 'tech_lead_gate_plan',
    description: 'Generate deterministic reviewer roles, evidence minimum, quorum, and gate conditions.',
    parameters: { impactJson: { type: 'string', required: true }, contextJson: { type: 'string', required: true } },
    async execute(args) {
      return runGuarded('gate_plan', () => {
        const input = parseJsonFields(args ?? {}, ['impactJson', 'contextJson']);
        if (!input.ok) return renderEnvelope(errorEnvelope('gate_plan', 'BAD_INPUT', input.errors));
        const errors = [];
        for (const [key, requirement] of [['impactJson', 'object'], ['contextJson', 'object']]) {
          const value = input.values[key];
          if (value === null || typeof value !== 'object' || Array.isArray(value)) errors.push({ code: 'BAD_INPUT', path: key, message: `expected JSON object` });
        }
        if (errors.length) return renderEnvelope(errorEnvelope('gate_plan', 'BAD_INPUT', errors));
        return renderEnvelope(okEnvelope('gate_plan', core.gatePlan(input.values.impactJson, input.values.contextJson)));
      });
    },
  });
  add({
    name: 'tech_lead_gate_aggregate',
    description: 'Aggregate anchored role reports, propagate rejects, and de-duplicate findings.',
    parameters: { reportsJson: { type: 'string', required: true }, planJson: { type: 'string', required: true } },
    async execute(args) {
      return runGuarded('gate_aggregate', () => {
        const input = parseJsonFields(args ?? {}, ['reportsJson', 'planJson']);
        if (!input.ok) return renderEnvelope(errorEnvelope('gate_aggregate', 'BAD_INPUT', input.errors));
        const errors = [];
        if (!Array.isArray(input.values.reportsJson)) errors.push({ code: 'BAD_INPUT', path: 'reportsJson', message: 'expected JSON array' });
        const plan = input.values.planJson;
        if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) errors.push({ code: 'BAD_INPUT', path: 'planJson', message: 'expected JSON object' });
        else if (!Array.isArray(plan.requiredRoles) || plan.requiredRoles.length === 0 || !Number.isInteger(plan.quorum) || plan.quorum <= 0) {
          errors.push({ code: 'BAD_INPUT', path: 'planJson', message: 'plan needs non-empty requiredRoles and a positive integer quorum' });
        }
        if (errors.length) return renderEnvelope(errorEnvelope('gate_aggregate', 'BAD_INPUT', errors));
        const result = core.gateAggregate(input.values.reportsJson, plan);
        return renderEnvelope(result.pass ? okEnvelope('gate_aggregate', result) : errorEnvelope('gate_aggregate', 'GATE_BLOCKED', result.findings, result));
      });
    },
  });
  add({
    name: 'tech_lead_gate_reopen',
    description: 'Detect whether a previously passed gate must reopen after snapshot drift.',
    parameters: { previousJson: { type: 'string', required: true }, currentJson: { type: 'string', required: true } },
    async execute(args) {
      return runGuarded('gate_reopen', () => {
        const input = parseJsonFields(args ?? {}, ['previousJson', 'currentJson']);
        if (!input.ok) return renderEnvelope(errorEnvelope('gate_reopen', 'BAD_INPUT', input.errors));
        const result = core.gateReopen(input.values.previousJson, input.values.currentJson);
        return renderEnvelope(result.reopen ? errorEnvelope('gate_reopen', 'DRIFT_DETECTED', result.reasons, result) : okEnvelope('gate_reopen', result));
      });
    },
  });
  return output;
}
