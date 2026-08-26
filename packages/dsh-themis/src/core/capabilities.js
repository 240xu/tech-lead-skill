const CAPABILITIES = Object.freeze([
  ['tech_lead_classify', 'classification', 'primitive+csv', 'medium'],
  ['tech_lead_state_validate', 'state', 'json-string', 'medium'],
  ['tech_lead_transition_check', 'state', 'json-string+primitive', 'high'],
  ['tech_lead_plan_lint', 'planning', 'json-string', 'medium'],
  ['tech_lead_evidence_lint', 'evidence', 'json-string+primitive', 'high'],
  ['tech_lead_gate_precheck', 'gates', 'json-string', 'high'],
  ['tech_lead_release_audit', 'release', 'json-string+csv', 'high'],
  ['tech_lead_install_audit', 'installation', 'json-string+csv', 'high'],
  ['tech_lead_resume_card', 'reconcile', 'json-string+primitive', 'medium'],
  ['tech_lead_context_validate', 'context', 'json-string', 'medium'],
  ['tech_lead_evidence_graph_lint', 'evidence', 'json-string', 'high'],
  ['tech_lead_evidence_freshness', 'evidence', 'json-string', 'high'],
  ['tech_lead_assumption_register', 'context', 'json-string', 'medium'],
  ['tech_lead_progress_decide', 'progress', 'json-string', 'high'],
  ['tech_lead_critical_path', 'progress', 'json-string', 'high'],
  ['tech_lead_change_impact', 'impact', 'json-string', 'high'],
  ['tech_lead_resume_reconcile', 'reconcile', 'json-string', 'high'],
  ['tech_lead_gate_plan', 'gates', 'json-string', 'high'],
  ['tech_lead_gate_aggregate', 'gates', 'json-string', 'high'],
  ['tech_lead_gate_reopen', 'gates', 'json-string', 'high'],
  ['tech_lead_mutation_preview', 'mutation', 'json-string', 'high'],
].map(([name, domain, inputMode, risk]) => Object.freeze({
  name,
  version: '1',
  domain,
  sideEffects: false,
  inputMode,
  risk,
})));

export function getCapabilities() {
  return CAPABILITIES.map((capability) => ({ ...capability }));
}
