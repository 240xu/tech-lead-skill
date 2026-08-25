import { defineTool } from '@deepseek-ai/dsh-tools';
import {
  classify, validateState, transitionCheck,
  evidenceLint, planLint, gatePrecheck,
  releaseAudit, installAudit, resumeCard,
} from '@240xu/dsh-tech-lead-core';
import { registerTools } from './tools.js';

export const name = 'tech-lead-tools';
export const inject = ['tools'];

/**
 * Registers the nine read-only tech-lead tools. Every tool computes over
 * caller-supplied JSON — no filesystem writes, no subprocesses, no network.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  for (const tool of registerTools(defineTool, {
    classify, validateState, transitionCheck,
    evidenceLint, planLint, gatePrecheck,
    releaseAudit, installAudit, resumeCard,
  })) {
    ctx.tools.register(tool);
  }
}
