import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

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
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
