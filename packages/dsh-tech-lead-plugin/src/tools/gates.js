import { errorEnvelope, makeAction, normalizeGuidance, okEnvelope } from '@240xu/dsh-tech-lead-core';
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
        if (!input.ok) return renderEnvelope(errorEnvelope('gate_plan', input.code ?? 'BAD_INPUT', input.errors));
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
        if (!input.ok) return renderEnvelope(errorEnvelope('gate_aggregate', input.code ?? 'BAD_INPUT', input.errors));
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
        const reports = Array.isArray(input.values.reportsJson) ? input.values.reportsJson : [];
        const conditionalCount = reports.filter((report) => report && report.verdict === 'conditional').length;
        const derived = [
          ...result.missingRoles.map((role) => ({ code: 'MISSING_ROLE', path: `/roles/${role}`, message: `no anchored report from required role "${role}"` })),
          ...(conditionalCount > 0 ? [{ code: 'CONDITIONAL_VERDICT', path: '/reports', message: `${conditionalCount} report(s) hold a conditional verdict` }] : []),
          ...(result.verdict !== 'reject' && result.findings.filter((f) => f.code).length === 0 && reports.length < plan.quorum
            ? [{ code: 'QUORUM_UNMET', path: '/reports', message: `${reports.length} of ${plan.quorum} reports present` }]
            : []),
        ];
        // Governance-negative outcomes are valid analyses: ok:true with the
        // verdict/findings in data plus deterministic closure guidance.
        const actions = [];
        for (const role of result.missingRoles) {
          actions.push(makeAction({
            kind: 'gate', targetId: role, reasonCodes: ['MISSING_ROLE'], findingRef: `/roles/${role}`,
            action: `Obtain one anchored ${role} review.`,
            doneWhen: `reports contain a valid ${role} report with verdict 'pass' and non-empty anchors`,
            nextTool: 'tech_lead_gate_aggregate',
          }));
        }
        reports.forEach((report, index) => {
          if (report?.verdict === 'conditional') {
            actions.push(makeAction({
              kind: 'gate', targetId: report.role ?? `report-${index}`, reasonCodes: ['CONDITIONAL_VERDICT'], findingRef: `/reports/${index}`,
              action: `Resolve the conditional findings raised by the ${report.role ?? 'reviewer'} report, then re-submit with verdict 'pass'.`,
              doneWhen: `reports[${index}].verdict === 'pass'`,
              nextTool: 'tech_lead_gate_aggregate',
            }));
          }
          if (report?.verdict === 'reject') {
            actions.push(makeAction({
              kind: 'safety', targetId: report.role ?? `report-${index}`, reasonCodes: ['REJECT'], findingRef: `/reports/${index}`,
              action: `Address every finding behind the ${report.role ?? 'reviewer'} rejection before another round.`,
              doneWhen: 'all referenced findings are resolved and a fresh anchored pass report replaces the reject',
            }));
          }
        });
        for (const item of [...derived, ...result.findings]) {
          if (item.code === 'QUORUM_UNMET') {
            actions.push(makeAction({
              kind: 'gate', targetId: 'quorum', reasonCodes: ['QUORUM_UNMET'], findingRef: '/reports',
              action: `Collect ${plan.quorum - reports.length} more distinct anchored report(s).`,
              doneWhen: `distinct valid reports count >= ${plan.quorum}`,
              nextTool: 'tech_lead_gate_aggregate',
            }));
          }
          if (item.code === 'INVALID_REPORT' || item.code === 'INVALID_VERDICT' || item.code === 'DUPLICATE_ROLE') {
            actions.push(makeAction({
              kind: 'safety', targetId: item.path ?? 'reports', reasonCodes: [item.code], findingRef: item.path ?? '/reports',
              action: 'Fix the malformed report entry named by this finding.',
              doneWhen: `no ${item.code} finding remains`,
            }));
          }
        }
        const guidance = normalizeGuidance({ mode: 'strict', outcome: result.pass ? 'CONTINUE' : 'PAUSE', meaning: result.pass ? undefined : 'Gate is not passed yet.', actions });
        const enriched = { ...result, findings: [...result.findings, ...derived], guidance };
        return renderEnvelope(okEnvelope('gate_aggregate', enriched));
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
        if (!input.ok) return renderEnvelope(errorEnvelope('gate_reopen', input.code ?? 'BAD_INPUT', input.errors));
        const errors = [];
        for (const key of ['previousJson', 'currentJson']) {
          const value = input.values[key];
          const usable = value !== null && typeof value === 'object' && !Array.isArray(value) && FINGERPRINT_KEYS.some((k) => value[k] !== undefined);
          if (!usable) errors.push({ code: 'BAD_INPUT', path: key, message: `expected an object containing at least one of: ${FINGERPRINT_KEYS.join(', ')}` });
        }
        if (errors.length) return renderEnvelope(errorEnvelope('gate_reopen', 'BAD_INPUT', errors));
        const result = core.gateReopen(input.values.previousJson, input.values.currentJson);
        const reasons = result.changedInputs.map((item) => ({ code: `${item.toUpperCase()}_DRIFT`, path: `/${item}Fingerprint`, message: `${item} changed` }));
        return renderEnvelope(okEnvelope('gate_reopen', result, result.reopen ? reasons : []));
      });
    },
  });
  return output;
}
