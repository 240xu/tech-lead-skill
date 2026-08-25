#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const pkgRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
const srcSkill = path.join(pkgRoot, 'skill');
const args = process.argv.slice(2);
const defaultTarget = path.resolve(path.join(os.homedir(), '.config', 'opencode', 'skills', 'tech-lead'));
const markerName = '.tech-lead-skill.json';
const knownFlags = new Set(['--help', '-h', '--version', '-v', '--uninstall', '--target']);

for (const arg of args) {
  if (arg.startsWith('-') && !knownFlags.has(arg)) {
    console.error('unknown option: ' + arg);
    process.exit(2);
  }
}

function argValue(name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (!value || value.startsWith('-')) {
    console.error(name + ' requires a directory argument');
    process.exit(2);
  }
  return value;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(
    `tech-lead-skill ${pkg.version}\n` +
    'Usage: tech-lead-skill [options]\n' +
    '  (no args)         install into ~/.config/opencode/skills/tech-lead\n' +
    '  --target <dir>    install into <dir>\n' +
    '  --uninstall       remove the installed skill directory\n' +
    '  --version         print version\n' +
    '  --help            show this help'
  );
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(pkg.version);
  process.exit(0);
}

let target = argValue('--target') || defaultTarget;
target = path.resolve(target);

if (args.includes('--uninstall')) {
  const marker = path.join(target, markerName);
  if (!fs.existsSync(marker)) {
    console.error('refusing to recursively remove an unmarked target: ' + target);
    console.error('install this package there first, or remove it manually after checking the path');
    process.exit(2);
  }
  fs.rmSync(target, { recursive: true, force: true });
  console.log('removed: ' + target);
  process.exit(0);
}

function copyWithBackup(src, dest) {
  if (fs.existsSync(dest)) {
    const bak = dest + '.bak-' + Date.now();
    fs.copyFileSync(dest, bak);
    console.log('backup : ' + bak);
  }
  fs.copyFileSync(src, dest);
}

fs.mkdirSync(path.join(target, 'templates'), { recursive: true });
copyWithBackup(path.join(srcSkill, 'SKILL.md'), path.join(target, 'SKILL.md'));
for (const f of fs.readdirSync(path.join(srcSkill, 'templates'))) {
  if (!f.endsWith('.md')) continue;
  copyWithBackup(path.join(srcSkill, 'templates', f), path.join(target, 'templates', f));
}
fs.writeFileSync(path.join(target, markerName), JSON.stringify({
  package: pkg.name,
  version: pkg.version,
  managedFiles: ['SKILL.md', 'templates/*.md'],
}, null, 2) + '\n');
console.log('installed: tech-lead-skill v' + pkg.version + ' -> ' + target);
