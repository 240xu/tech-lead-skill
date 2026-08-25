import { errorEnvelope, previewMutation } from '@240xu/dsh-tech-lead-core';

export function registerMutationTools(defineTool) {
  return [defineTool({
    name: 'tech_lead_mutation_preview',
    description: 'Validate and preview a mutation intent. Never writes files or executes commands.',
    parameters: { intentJson: { type: 'string', required: true, description: 'mutation intent JSON text' } },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      if (typeof args.intentJson !== 'string') return JSON.stringify(errorEnvelope('mutation_preview', 'BAD_INPUT', [{ path: 'intentJson', message: 'expected JSON text string' }]));
      try { return JSON.stringify(previewMutation(JSON.parse(args.intentJson)), null, 2); }
      catch (error) { return JSON.stringify(errorEnvelope('mutation_preview', 'BAD_INPUT', [{ path: 'intentJson', message: `invalid JSON: ${error.message}` }])); }
    },
  })];
}
