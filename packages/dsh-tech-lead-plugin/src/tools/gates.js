import { errorEnvelope, okEnvelope } from '@240xu/dsh-tech-lead-core';

const parse = (value, path) => {
  if (typeof value !== 'string') return { ok: false, error: { code: 'BAD_INPUT', path, message: 'expected JSON text string' } };
  try { return { ok: true, value: JSON.parse(value) }; }
  catch (error) { return { ok: false, error: { code: 'BAD_INPUT', path, message: `invalid JSON: ${error.message}` } }; }
};
const render = (value) => JSON.stringify(value, null, 2);
const parsePair = (args, left, right) => {
  const a = parse(args[left], left);
  if (!a.ok) return a;
  const b = parse(args[right], right);
  return b.ok ? { ok: true, values: [a.value, b.value] } : b;
};
const objectInput = (value, path) => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? { ok: true, value }
  : { ok: false, error: { code: 'BAD_INPUT', path, message: 'expected JSON object' } };
const arrayInput = (value, path) => Array.isArray(value)
  ? { ok: true, value }
  : { ok: false, error: { code: 'BAD_INPUT', path, message: 'expected JSON array' } };

export function registerGateTools(defineTool, core) {
  const output = [];
  const add = (definition) => output.push(defineTool({ ...definition, output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] } }));
  add({
    name: 'tech_lead_gate_plan',
    description: 'Generate deterministic reviewer roles, evidence minimum, quorum, and gate conditions.',
    parameters: { impactJson: { type: 'string', required: true }, contextJson: { type: 'string', required: true } },
    async execute(args) {
      const input = parsePair(args, 'impactJson', 'contextJson');
      if (!input.ok) return render(errorEnvelope('gate_plan', input.error.code, [input.error]));
      const impact = objectInput(input.values[0], 'impactJson');
      const context = objectInput(input.values[1], 'contextJson');
      if (!impact.ok || !context.ok) return render(errorEnvelope('gate_plan', 'BAD_INPUT', [impact.error ?? context.error]));
      return render(okEnvelope('gate_plan', core.gatePlan(impact.value, context.value)));
    },
  });
  add({
    name: 'tech_lead_gate_aggregate',
    description: 'Aggregate anchored role reports, propagate rejects, and de-duplicate findings.',
    parameters: { reportsJson: { type: 'string', required: true }, planJson: { type: 'string', required: true } },
    async execute(args) {
      const input = parsePair(args, 'reportsJson', 'planJson');
      if (!input.ok) return render(errorEnvelope('gate_aggregate', input.error.code, [input.error]));
      const reports = arrayInput(input.values[0], 'reportsJson');
      const plan = objectInput(input.values[1], 'planJson');
      if (!reports.ok || !plan.ok || !Array.isArray(plan.value?.requiredRoles) || plan.value.requiredRoles.length === 0 || !Number.isInteger(plan.value.quorum) || plan.value.quorum <= 0) return render(errorEnvelope('gate_aggregate', 'BAD_INPUT', [reports.error ?? plan.error ?? { code: 'BAD_INPUT', path: 'planJson', message: 'plan needs requiredRoles and positive integer quorum' }]));
      const result = core.gateAggregate(reports.value, plan.value);
      return render(result.pass ? okEnvelope('gate_aggregate', result) : errorEnvelope('gate_aggregate', 'GATE_BLOCKED', result.findings, result));
    },
  });
  add({
    name: 'tech_lead_gate_reopen',
    description: 'Detect whether a previously passed gate must reopen after snapshot drift.',
    parameters: { previousJson: { type: 'string', required: true }, currentJson: { type: 'string', required: true } },
    async execute(args) {
      const input = parsePair(args, 'previousJson', 'currentJson');
      if (!input.ok) return render(errorEnvelope('gate_reopen', input.error.code, [input.error]));
      const result = core.gateReopen(input.values[0], input.values[1]);
      return render(result.reopen ? errorEnvelope('gate_reopen', 'DRIFT_DETECTED', result.reasons, result) : okEnvelope('gate_reopen', result));
    },
  });
  return output;
}
