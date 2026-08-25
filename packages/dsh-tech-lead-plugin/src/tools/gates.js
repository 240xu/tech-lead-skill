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
      return render(okEnvelope('gate_plan', core.gatePlan(input.values[0], input.values[1])));
    },
  });
  add({
    name: 'tech_lead_gate_aggregate',
    description: 'Aggregate anchored role reports, propagate rejects, and de-duplicate findings.',
    parameters: { reportsJson: { type: 'string', required: true }, planJson: { type: 'string', required: true } },
    async execute(args) {
      const input = parsePair(args, 'reportsJson', 'planJson');
      if (!input.ok) return render(errorEnvelope('gate_aggregate', input.error.code, [input.error]));
      const result = core.gateAggregate(input.values[0], input.values[1]);
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
