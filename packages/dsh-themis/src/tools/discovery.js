import { errorEnvelope, capabilityFilterValues, getCapabilities, okEnvelope } from '../core/index.js';
import { renderEnvelope, runGuarded } from '../protocol.js';

export function registerDiscoveryTools(defineTool, core, registeredNames) {
  const catalog = typeof core?.getCapabilities === 'function' ? core.getCapabilities : getCapabilities;
  return [defineTool({
    name: 'tech_lead_capabilities',
    description: 'Discover the governance tools registered in this bundle. Optional filters narrow the deterministic catalog; nextTools entries always reference currently registered tools.',
    parameters: {
      recipe: { type: 'string', description: `optional recipe filter; one of ${capabilityFilterValues().recipes.join('|')}` },
      domain: { type: 'string', description: `optional domain filter; one of ${capabilityFilterValues().domains.join('|')}` },
    },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      return runGuarded('tech_lead_capabilities', () => {
        args = args !== null && typeof args === 'object' ? args : {};
        const values = capabilityFilterValues();
        const errors = [];
        if (args.recipe != null && !values.recipes.includes(args.recipe)) {
          errors.push({ code: 'BAD_INPUT', path: '/recipe', message: `recipe must be one of ${values.recipes.join('|')}` });
        }
        if (args.domain != null && !values.domains.includes(args.domain)) {
          errors.push({ code: 'BAD_INPUT', path: '/domain', message: `domain must be one of ${values.domains.join('|')}` });
        }
        if (errors.length) return renderEnvelope(errorEnvelope('tech_lead_capabilities', 'BAD_INPUT', errors));
        let capabilities = catalog({ registeredNames });
        if (args.recipe != null) capabilities = capabilities.filter((c) => c.recipe === args.recipe);
        if (args.domain != null) capabilities = capabilities.filter((c) => c.domain === args.domain);
        return renderEnvelope(okEnvelope('tech_lead_capabilities', { capabilities }));
      });
    },
  })];
}
