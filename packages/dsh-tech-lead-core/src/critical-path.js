const items = (value) => Array.isArray(value) ? value : [];

export function criticalPath(tasks, dependencies) {
  const nodes = new Map(items(tasks).map((task) => [String(task?.id), task]));
  const findings = [];
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
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const next of outgoing.get(id)) {
      incoming.set(next, incoming.get(next) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }
  if (order.length !== nodes.size) findings.push({ code: 'CYCLE', message: 'dependency graph contains a cycle' });
  const critical = order.filter((id) => nodes.get(id)?.status !== 'done' && (outgoing.get(id).length > 0 || originalIncoming.get(id) > 0));
  const parallelWindows = order.filter((id) => nodes.get(id)?.status !== 'done' && originalIncoming.get(id) === 0 && outgoing.get(id).length === 0).map((id) => [id]);
  return { blockers: order.filter((id) => nodes.get(id)?.blocker), criticalPath: critical, parallelWindows, findings };
}
