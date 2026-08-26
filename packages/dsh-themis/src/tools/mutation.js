import { errorEnvelope, previewMutation } from '../core/index.js';
import { parseJsonString, renderEnvelope, runGuarded } from '../protocol.js';

export function registerMutationTools(defineTool) {
  return [defineTool({
    name: 'tech_lead_mutation_preview',
    description: 'Validate and preview a MutationIntent without executing anything. Schema tech-lead.mutation-intent.v1: mode MUST be "read-only-preview"; requires target[] (each {path,operation}; operations apply/execute/deploy are always denied; expectedDiff[], recoveryPoint{required:true,...}, verification[] commands-as-inert-strings, authorization{required:true}. Returns CAPABILITY_DENIED for executable modes/markers, SCAN_INCOMPLETE (ok:false) when the bounded capability scan cannot certify the whole payload — never a silent pass — and SERIALIZATION_FAILED for unserializable payloads.',
    parameters: { intentJson: { type: 'string', required: true, description: 'mutation intent JSON text' } },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      return runGuarded('mutation_preview', () => {
        const parsed = parseJsonString(args?.intentJson, 'intentJson', 'mutation');
        if (!parsed.ok) return renderEnvelope(errorEnvelope('mutation_preview', parsed.error.code, [parsed.error]));
        return renderEnvelope(previewMutation(parsed.value));
      });
    },
  })];
}
