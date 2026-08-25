import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = Number(process.env.CORDIS_TIMEOUT_MS ?? 180000);

// createRequire needs a filesystem anchor inside this directory for module
// resolution; the anchor file itself does not need to exist.
function resolveCordisBin() {
  if (process.env.CORDIS_BIN) return process.env.CORDIS_BIN;
  const require = createRequire(join(here, 'noop.js'));
  const pkgPath = require.resolve('@deepseek-ai/cordis/package.json');
  const pkg = require(pkgPath);
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[pkg.name] ?? pkg.bin?.cordis;
  if (!bin) throw new Error('@deepseek-ai/cordis package.json has no bin entry');
  return join(dirname(pkgPath), bin);
}

let bin;
try {
  bin = resolveCordisBin();
} catch {
  console.error('error: @deepseek-ai/cordis is not resolvable from this workspace.');
  console.error('fix: run `pnpm install` at the repository root (or set CORDIS_BIN).');
  process.exit(1);
}

const child = spawn(process.execPath, [bin], { cwd: here, stdio: 'inherit' });
let settled = false;
const finish = (fn) => { if (!settled) { settled = true; fn(); } };
const timer = setTimeout(() => {
  console.error(`error: composition harness exceeded ${TIMEOUT_MS}ms; killing cordis child`);
  child.kill('SIGKILL');
}, TIMEOUT_MS);

child.on('error', (error) => {
  clearTimeout(timer);
  console.error(`error: failed to launch cordis (${error.code ?? error.message}).`);
  console.error('fix: verify @deepseek-ai/cordis installation or set CORDIS_BIN.');
  finish(() => process.exit(1));
});
child.on('exit', (code, signal) => {
  clearTimeout(timer);
  if (signal) process.kill(process.pid, signal);
  else finish(() => process.exit(code ?? 1));
});
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { child.kill(sig); });
}
