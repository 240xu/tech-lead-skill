import { errorEnvelope, okEnvelope } from '@240xu/dsh-tech-lead-core';
import { canonicalStringify, parseJsonFields, renderEnvelope, runGuarded } from '../protocol.js';

const BLOCKING_FINDINGS = new Set(['CYCLE', 'INVALID_TASK_ID', 'DUPLICATE_TASK_ID']);

export function registerProgressTools(defineTool, core) {
  const output = [];
  const register = (name, description, parameters, execute) => output.push(defineTool({ name, description, parameters, output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] }, execute }));
  register('tech_lead_progress_decide', 'Decide the next lifecycle outcome (CONTINUE/PAUSE/SCOPE-DOWN/PIVOT/STOP). Trigger fields: dependencies[] pauses when an entry has blocker:true and status!=="done"; evidence[] pauses when an entry has stale:true; gates[] pauses when an entry has destructive:true and status!=="pass". optionsJson supports {forcePivot:true} which returns a PIVOT decision as an error envelope (code PIVOT_REQUESTED) — ok means "no blockers", not "call failed".', {
    contextJson: { type: 'string', required: true, description: 'context snapshot JSON text with dependencies/evidence/gates arrays' },
    optionsJson: { type: 'string', description: 'optional JSON text ({forcePivot?:boolean})' },
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
  register('tech_lead_critical_path', 'Compute blockers, critical path, cycles (with cycleNodes), and parallel windows. Both inputs must be JSON arrays; graph findings (CYCLE / INVALID_TASK_ID / DUPLICATE_TASK_ID) are returned as envelope errors under code SCHEMA_INVALID.', {
    tasksJson: { type: 'string', required: true, description: '[{id,status?,blocker?}] as JSON text' },
    dependenciesJson: { type: 'string', required: true, description: '[{from,to}] edge list as JSON text; from blocks to' },
  }, async (args) => {
    return runGuarded('critical_path', () => {
      const input = parseJsonFields(args ?? {}, ['tasksJson', 'dependenciesJson']);
      if (!input.ok) return renderEnvelope(errorEnvelope('critical_path', 'BAD_INPUT', input.errors));
      const errors = [];
      if (!Array.isArray(input.values.tasksJson)) errors.push({ code: 'BAD_INPUT', path: 'tasksJson', message: 'expected JSON array of tasks' });
      if (!Array.isArray(input.values.dependenciesJson)) errors.push({ code: 'BAD_INPUT', path: 'dependenciesJson', message: 'expected JSON array of edges' });
      if (errors.length) return renderEnvelope(errorEnvelope('critical_path', 'BAD_INPUT', errors));
      const result = core.criticalPath(input.values.tasksJson, input.values.dependenciesJson);
      const blocking = result.findings.filter((f) => BLOCKING_FINDINGS.has(f.code));
      if (blocking.length) {
        return renderEnvelope(errorEnvelope('critical_path', 'SCHEMA_INVALID', result.findings.map((f) => ({ ...f, code: f.code })), result));
      }
      return renderEnvelope(okEnvelope('critical_path', result));
    });
  });
  register('tech_lead_change_impact', 'Classify change impact (T0/T1/T2), reversibility, and Gate reopen requirements without applying the change. Trigger fields: irreversible (any truthy), publicInterface, modules[], assets[].', {
    changeJson: { type: 'string', required: true, description: '{modules?:string[],assets?:string[],irreversible?,publicInterface?} as JSON text' },
    contextJson: { type: 'string', required: true, description: 'context snapshot JSON text ({gates?:[{id}]})' },
  }, async (args) => {
    return runGuarded('change_impact', () => {
      const input = parseJsonFields(args ?? {}, ['changeJson', 'contextJson']);
      if (!input.ok) return renderEnvelope(errorEnvelope('change_impact', 'BAD_INPUT', input.errors));
      return renderEnvelope(okEnvelope('change_impact', core.changeImpact(input.values.changeJson, input.values.contextJson)));
    });
  });
  register('tech_lead_resume_reconcile', 'Compare two inline snapshots key-order-insensitively and report deterministic drift with the differing top-level keys.', {
    previousJson: { type: 'string', required: true, description: 'previous snapshot JSON text' },
    currentJson: { type: 'string', required: true, description: 'current snapshot JSON text' },
  }, async (args) => {
    return runGuarded('resume_reconcile', () => {
      const input = parseJsonFields(args ?? {}, ['previousJson', 'currentJson']);
      if (!input.ok) return renderEnvelope(errorEnvelope('resume_reconcile', 'BAD_INPUT', input.errors));
      const previous = canonicalStringify(input.values.previousJson);
      const current = canonicalStringify(input.values.currentJson);
      const changed = JSON.stringify(previous) !== JSON.stringify(current);
      if (!changed) return renderEnvelope(okEnvelope('resume_reconcile', { drift: false }));
      const changedKeys = computeChangedKeys(previous, current);
      return renderEnvelope(errorEnvelope('resume_reconcile', 'DRIFT_DETECTED', changedKeys.map((key) => ({ code: 'KEY_DRIFT', path: `/${key}`, message: `value differs at top-level key "${key}"` })), { drift: true, changedKeys }));
    });
  });
  return output;
}

function computeChangedKeys(a, b) {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key])).sort();
}
