#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const pkgRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
const srcSkill = path.join(pkgRoot, 'skill');
const args = process.argv.slice(2);

function argValue(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
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

let target = argValue('--target') || path.join(os.homedir(), '.config', 'opencode', 'skills', 'tech-lead');
target = path.resolve(target);

if (args.includes('--uninstall')) {
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
console.log('installed: tech-lead-skill v' + pkg.version + ' -> ' + target);
