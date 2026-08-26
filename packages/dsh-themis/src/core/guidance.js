// R6 Guidance Contract. Pure builders: deterministic ids, fixed category
// ordering, hard caps. Heuristic suggestions are append-only metadata that can
// never alter strict actions or domain outcomes.

const CATEGORY_ORDER = ['safety', 'gate', 'dependency', 'evidence', 'assumption', 'ready', 'hygiene'];
const MAX_ACTIONS = 50;

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Build one normalized strict action. Missing optional targetId is allowed
 * when no stable caller-supplied identifier exists.
 */
export function makeAction({ kind, targetId, reasonCodes, findingRef, action, doneWhen, nextTool } = {}) {
  const base = {
    kind,
    targetId: targetId === undefined ? undefined : String(targetId),
    reasonCodes: Array.isArray(reasonCodes) ? reasonCodes.map(String) : [],
    findingRef: findingRef === undefined ? undefined : String(findingRef),
    action,
    doneWhen,
    nextTool: nextTool === undefined ? undefined : String(nextTool),
  };
  base.actionId = `${base.kind}:${base.targetId ?? '-'}:${base.reasonCodes.join('+')}:${fnv1a(`${base.action}|${base.doneWhen}`)}`;
  return base;
}

function isValidAction(candidate) {
  return candidate !== null && typeof candidate === 'object'
    && CATEGORY_ORDER.includes(candidate.kind)
    && Array.isArray(candidate.reasonCodes) && candidate.reasonCodes.length > 0
    && isNonEmptyString(candidate.findingRef)
    && isNonEmptyString(candidate.action)
    && isNonEmptyString(candidate.doneWhen);
}

function isValidHeuristic(candidate) {
  return candidate !== null && typeof candidate === 'object'
    && isNonEmptyString(candidate.id)
    && typeof candidate.confidence === 'number' && Number.isFinite(candidate.confidence)
    && candidate.confidence >= 0 && candidate.confidence <= 1
    && Array.isArray(candidate.applicableWhen)
    && isNonEmptyString(candidate.suggestion)
    && isNonEmptyString(candidate.smallestExperiment)
    && Array.isArray(candidate.cannotProve);
}

/**
 * Normalize a guidance block. Strict actions are ordered by the fixed policy
 * sequence (safety → gates → dependencies → evidence → assumptions → ready →
 * hygiene), then by deterministic actionId. Priorities are consecutive from 1.
 * The synthesized queue is hard-capped at MAX_ACTIONS with truncated:true.
 *
 * Heuristics are attached ONLY under explicit mode:'heuristic'; they are
 * labeled advisory data and never merged into actions.
 */
export function normalizeGuidance({ mode = 'strict', outcome = 'NONE', meaning, actions = [], heuristics = [] } = {}) {
  const warnings = [];
  const source = Array.isArray(actions) ? actions : [];
  const valid = [];
  source.forEach((candidate, index) => {
    if (!isValidAction(candidate)) {
      warnings.push({ code: 'INVALID_ACTION', path: `/actions/${index}`, message: 'action missing required kind/reasonCodes/findingRef/action/doneWhen' });
      return;
    }
    const normalized = candidate.actionId ? candidate : makeAction(candidate);
    valid.push(normalized);
  });
  valid.sort((a, b) => {
    const ka = CATEGORY_ORDER.indexOf(a.kind);
    const kb = CATEGORY_ORDER.indexOf(b.kind);
    return ka !== kb ? ka - kb : (a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0);
  });
  const truncated = valid.length > MAX_ACTIONS;
  const capped = truncated ? valid.slice(0, MAX_ACTIONS) : valid;
  const guidance = {
    mode: mode === 'heuristic' ? 'heuristic' : 'strict',
    decision: { outcome, ...(meaning ? { meaning } : {}) },
    nextActions: capped.map((action, index) => ({ ...action, priority: index + 1 })),
    resumeWhen: [],
    warnings,
  };
  if (truncated) guidance.truncated = true;
  if (guidance.mode === 'heuristic') {
    const sourceHeuristics = Array.isArray(heuristics) ? heuristics : [];
    const accepted = [];
    sourceHeuristics.forEach((candidate, index) => {
      if (!isValidHeuristic(candidate)) {
        warnings.push({ code: 'INVALID_HEURISTIC', path: `/heuristics/${index}`, message: 'heuristic must carry id, bounded confidence, applicability, experiment, and cannotProve' });
        return;
      }
      accepted.push({
        ...candidate,
        confidence: Math.min(1, Math.max(0, candidate.confidence)),
        applicableWhen: candidate.applicableWhen.slice(),
        cannotProve: candidate.cannotProve.slice(),
      });
    });
    if (accepted.length) guidance.heuristics = accepted;
  }
  return guidance;
}
