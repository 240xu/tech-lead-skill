#!/usr/bin/env node
'use strict';
// Aggregate offline regression: installer + all core validators.
// (The DSH composition test is separate; see packages/dsh-tech-lead-plugin/test/composition/)
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [];
for (const dir of ['tests', 'packages/dsh-tech-lead-core/tests']) {
  const abs = path.join(root, dir);
  for (const f of fs.readdirSync(abs)) {
    if (f.endsWith('.test.js')) files.push(path.join(dir, f));
  }
}
files.sort();

const r = spawnSync(process.execPath, ['--test', ...files], {
  cwd: root, stdio: 'inherit',
});
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('\nnext: real-composition test —');
console.log('  cd packages/dsh-tech-lead-plugin/test/composition && node ' +
  '/data/data/com.termux/files/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/cordis/bin.js');
