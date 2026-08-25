import { errorEnvelope, okEnvelope } from '@240xu/dsh-tech-lead-core';
import { canonicalStringify, parseJsonFields, renderEnvelope, runGuarded } from '../protocol.js';

export function registerProgressTools(defineTool, core) {
  const output = [];
  const register = (name, description, parameters, execute) => output.push(defineTool({ name, description, parameters, output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] }, execute }));
  register('tech_lead_progress_decide', 'Decide the next lifecycle outcome from an inline context.', {
    contextJson: { type: 'string', required: true },
    optionsJson: { type: 'string', description: 'optional decision options JSON text (forcePivot)' },
  }, async (args) => {
    return runGuarded('progress_decide', () => {
      const input = parseJsonFields(args ?? {}, ['contextJson']);
      if (!input.ok) return renderEnvelope(errorEnvelope('progress_decide', 'BAD_INPUT', input.errors));
      let options = {};
      if (args.optionsJson != null && args.optionsJson !== '') {
        const parsedOptions = parseJsonFields(args, ['optionsJson']);
        if (!parsedOptions.ok) return renderEnvelope(errorEnvelope('progress_decide', 'BAD_INPUT', parsedOptions.errors));
        options = parsedOptions.values.optionsJson;
      }
      const result = core.progressDecide(input.values.contextJson, options);
      return renderEnvelope(result.outcome === 'CONTINUE' ? okEnvelope('progress_decide', result) : errorEnvelope('progress_decide', result.reasons?.[0]?.code ?? 'PROGRESS_BLOCKED', result.reasons, result));
    });
  });
  register('tech_lead_critical_path', 'Compute blockers, critical path, cycles, and parallel windows from inline task JSON.', {
    tasksJson: { type: 'string', required: true },
    dependenciesJson: { type: 'string', required: true },
  }, async (args) => {
    return runGuarded('critical_path', () => {
      const input = parseJsonFields(args ?? {}, ['tasksJson', 'dependenciesJson']);
      if (!input.ok) return renderEnvelope(errorEnvelope('critical_path', 'BAD_INPUT', input.errors));
      return renderEnvelope(okEnvelope('critical_path', core.criticalPath(input.values.tasksJson, input.values.dependenciesJson)));
    });
  });
  register('tech_lead_change_impact', 'Classify change impact and Gate reopen requirements without applying the change.', {
    changeJson: { type: 'string', required: true },
    contextJson: { type: 'string', required: true },
  }, async (args) => {
    return runGuarded('change_impact', () => {
      const input = parseJsonFields(args ?? {}, ['changeJson', 'contextJson']);
      if (!input.ok) return renderEnvelope(errorEnvelope('change_impact', 'BAD_INPUT', input.errors));
      return renderEnvelope(okEnvelope('change_impact', core.changeImpact(input.values.changeJson, input.values.contextJson)));
    });
  });
  register('tech_lead_resume_reconcile', 'Compare two inline snapshots and report deterministic drift (key-order insensitive).', {
    previousJson: { type: 'string', required: true },
    currentJson: { type: 'string', required: true },
  }, async (args) => {
    return runGuarded('resume_reconcile', () => {
      const input = parseJsonFields(args ?? {}, ['previousJson', 'currentJson']);
      if (!input.ok) return renderEnvelope(errorEnvelope('resume_reconcile', 'BAD_INPUT', input.errors));
      const changed = JSON.stringify(canonicalStringify(input.values.previousJson)) !== JSON.stringify(canonicalStringify(input.values.currentJson));
      return renderEnvelope(changed ? errorEnvelope('resume_reconcile', 'DRIFT_DETECTED', [{ code: 'DRIFT_DETECTED' }], { drift: true }) : okEnvelope('resume_reconcile', { drift: false }));
    });
  });
  return output;
}
