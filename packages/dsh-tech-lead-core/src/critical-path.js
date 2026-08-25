const items = (value) => Array.isArray(value) ? value : [];

export function criticalPath(tasks, dependencies) {
  const findings = [];
  const nodes = new Map();
  for (const [index, task] of items(tasks).entries()) {
    const id = typeof task?.id === 'string' ? task.id : '';
    if (!id) {
      findings.push({ code: 'INVALID_TASK_ID', path: `/tasks/${index}/id` });
      continue;
    }
    if (nodes.has(id)) {
      findings.push({ code: 'DUPLICATE_TASK_ID', path: `/tasks/${index}/id`, id });
      continue;
    }
    nodes.set(id, task);
  }
  const outgoing = new Map([...nodes.keys()].map((id) => [id, []]));
  const incoming = new Map([...nodes.keys()].map((id) => [id, 0]));
  for (const edge of items(dependencies)) {
    const from = String(edge?.from);
    const to = String(edge?.to);
    if (!nodes.has(from) || !nodes.has(to)) {
      findings.push({ code: 'UNKNOWN_DEPENDENCY', from, to });
      continue;
    }
    outgoing.get(to).push(from);
    incoming.set(from, incoming.get(from) + 1);
  }
  const originalIncoming = new Map(incoming);
  const queue = [...incoming.entries()].filter(([, count]) => count === 0).map(([id]) => id);
  const order = [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    order.push(id);
    for (const next of outgoing.get(id)) {
      incoming.set(next, incoming.get(next) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }
  if (order.length !== nodes.size) {
    const orderedSet = new Set(order);
    const cycleNodes = [...nodes.keys()].filter((id) => !orderedSet.has(id)).sort();
    findings.push({ code: 'CYCLE', message: 'dependency graph contains a cycle', cycleNodes });
  }
  const active = (id) => nodes.get(id)?.status !== 'done';
  const critical = order.filter((id) => active(id) && (outgoing.get(id).length > 0 || originalIncoming.get(id) > 0));
  const parallelWindows = order.filter((id) => active(id) && originalIncoming.get(id) === 0 && outgoing.get(id).length === 0).map((id) => [id]);
  return { blockers: order.filter((id) => nodes.get(id)?.blocker && active(id)), criticalPath: critical, parallelWindows, findings };
}
