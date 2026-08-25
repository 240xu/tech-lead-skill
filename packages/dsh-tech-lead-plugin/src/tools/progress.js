import { errorEnvelope, okEnvelope } from '@240xu/dsh-tech-lead-core';

const parse = (value, path) => {
  if (typeof value !== 'string') return { ok: false, error: { code: 'BAD_INPUT', path, message: 'expected JSON text string' } };
  try { return { ok: true, value: JSON.parse(value) }; }
  catch (error) { return { ok: false, error: { code: 'BAD_INPUT', path, message: `invalid JSON: ${error.message}` } }; }
};
const render = (value) => JSON.stringify(value, null, 2);
const parseMany = (args, fields) => {
  const values = {};
  for (const field of fields) {
    const result = parse(args[field], field);
    if (!result.ok) return result;
    values[field] = result.value;
  }
  return { ok: true, value: values };
};

export function registerProgressTools(defineTool, core) {
  const output = [];
  const register = (name, description, parameters, execute) => output.push(defineTool({ name, description, parameters, output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] }, execute }));
  register('tech_lead_progress_decide', 'Decide the next lifecycle outcome from an inline context.', { contextJson: { type: 'string', required: true } }, async (args) => {
    const input = parse(args.contextJson, 'contextJson');
    if (!input.ok) return render(errorEnvelope('progress_decide', input.error.code, [input.error]));
    const options = args.optionsJson ? parse(args.optionsJson, 'optionsJson') : { ok: true, value: {} };
    if (!options.ok) return render(errorEnvelope('progress_decide', options.error.code, [options.error]));
    const result = core.progressDecide(input.value, options.value);
    return render(result.outcome === 'CONTINUE' ? okEnvelope('progress_decide', result) : errorEnvelope('progress_decide', result.reasons?.[0]?.code ?? 'PROGRESS_BLOCKED', result.reasons, result));
  });
  register('tech_lead_critical_path', 'Compute blockers, critical path, cycles, and parallel windows from inline task JSON.', { tasksJson: { type: 'string', required: true }, dependenciesJson: { type: 'string', required: true } }, async (args) => {
    const input = parseMany(args, ['tasksJson', 'dependenciesJson']);
    if (!input.ok) return render(errorEnvelope('critical_path', input.error.code, [input.error]));
    return render(okEnvelope('critical_path', core.criticalPath(input.value.tasksJson, input.value.dependenciesJson)));
  });
  register('tech_lead_change_impact', 'Classify change impact and Gate reopen requirements without applying the change.', { changeJson: { type: 'string', required: true }, contextJson: { type: 'string', required: true } }, async (args) => {
    const input = parseMany(args, ['changeJson', 'contextJson']);
    if (!input.ok) return render(errorEnvelope('change_impact', input.error.code, [input.error]));
    return render(okEnvelope('change_impact', core.changeImpact(input.value.changeJson, input.value.contextJson)));
  });
  register('tech_lead_resume_reconcile', 'Compare two inline snapshots and report deterministic drift.', { previousJson: { type: 'string', required: true }, currentJson: { type: 'string', required: true } }, async (args) => {
    const input = parseMany(args, ['previousJson', 'currentJson']);
    if (!input.ok) return render(errorEnvelope('resume_reconcile', input.error.code, [input.error]));
    const changed = JSON.stringify(input.value.previousJson) !== JSON.stringify(input.value.currentJson);
    return render(changed ? errorEnvelope('resume_reconcile', 'DRIFT_DETECTED', [{ code: 'DRIFT_DETECTED' }], { drift: true }) : okEnvelope('resume_reconcile', { drift: false }));
  });
  return output;
}
