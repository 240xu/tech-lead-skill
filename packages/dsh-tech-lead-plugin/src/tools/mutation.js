import { errorEnvelope, previewMutation } from '@240xu/dsh-tech-lead-core';
import { parseJsonString, renderEnvelope, runGuarded } from '../protocol.js';

export function registerMutationTools(defineTool) {
  return [defineTool({
    name: 'tech_lead_mutation_preview',
    description: 'Validate and preview a mutation intent. Never writes files or executes commands.',
    parameters: { intentJson: { type: 'string', required: true, description: 'mutation intent JSON text' } },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      return runGuarded('mutation_preview', () => {
        const parsed = parseJsonString(args?.intentJson, 'intentJson');
        if (!parsed.ok) return renderEnvelope(errorEnvelope('mutation_preview', parsed.error.code, [parsed.error]));
        return renderEnvelope(previewMutation(parsed.value));
      });
    },
  })];
}
