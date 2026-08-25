#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const pkgRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
const srcSkill = path.join(pkgRoot, 'skill');
const markerName = '.tech-lead-skill.json';
const args = process.argv.slice(2);
const defaultTarget = path.resolve(path.join(os.homedir(), '.config', 'opencode', 'skills', 'tech-lead'));
const knownFlags = new Set([
  '--help', '-h', '--version', '-v',
  '--uninstall', '--target', '--check', '--dry-run',
]);

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
    '  --check           verify installed files match this package\n' +
    '  --dry-run         print planned actions without writing anything\n' +
    '  --uninstall       remove only manifest-managed files (keeps user files)\n' +
    '  --version         print version\n' +
    '  --help            show this help'
  );
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(pkg.version);
  process.exit(0);
}

function walkFiles(root) {
  const out = [];
  (function walk(rel) {
    const abs = path.join(root, rel);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const relPath = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(relPath);
      else out.push(relPath.split(path.sep).join('/'));
    }
  })('');
  return out.sort();
}

function isBackup(rel) {
  return /\.bak-\d+$/.test(rel);
}

function readMarker(target) {
  try {
    return JSON.parse(fs.readFileSync(path.join(target, markerName), 'utf8'));
  } catch (_) {
    return null;
  }
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyWithBackup(src, dest) {
  if (fs.existsSync(dest)) {
    const bak = dest + '.bak-' + Date.now();
    fs.copyFileSync(dest, bak);
    console.log('backup : ' + bak);
  }
  fs.copyFileSync(src, dest);
}

let target = argValue('--target') || defaultTarget;
target = path.resolve(target);

const dryRun = args.includes('--dry-run');

// ── uninstall ────────────────────────────────────────────────────────────────
if (args.includes('--uninstall')) {
  const marker = readMarker(target);
  if (!marker || !Array.isArray(marker.files)) {
    console.error('refusing to remove an unmarked target: ' + target);
    console.error('install this package there first, or remove it manually after checking the path');
    process.exit(2);
  }
  let removed = 0;
  const dirsTouched = new Set();
  for (const rel of marker.files) {
    const abs = path.join(target, rel);
    dirsTouched.add(path.dirname(abs));
    if (dryRun) { console.log('would remove: ' + abs); continue; }
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
      removed++;
      console.log('removed : ' + rel);
    }
  }
  const markerAbs = path.join(target, markerName);
  if (dryRun) console.log('would remove: ' + markerAbs);
  else { fs.unlinkSync(markerAbs); removed++; }

  // Try to prune now-empty directories touched by the manifest (bottom-up).
  const sortedDirs = [...dirsTouched].sort((a, b) => b.length - a.length);
  for (const dir of sortedDirs) {
    if (dir === target) continue;
    if (!dryRun) { try { fs.rmdirSync(dir); } catch (_) { /* non-empty: keep */ } }
  }

  // Report leftovers so nothing disappears silently.
  const leftovers = [];
  (function scan(rel) {
    const abs = path.join(target, rel);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const relPath = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) scan(relPath);
      else leftovers.push(relPath.split(path.sep).join('/'));
    }
  })('');
  if (leftovers.length) {
    console.log('kept (not managed):');
    for (const rel of leftovers) console.log('  kept   : ' + rel);
  } else if (!dryRun && target !== os.homedir()) {
    try { fs.rmdirSync(target); console.log('removed empty target directory'); } catch (_) { /* keep */ }
  }
  console.log((dryRun ? '[dry-run] would remove ' : 'removed ') + removed + ' managed entr' + (removed === 1 ? 'y' : 'ies'));
  process.exit(0);
}

// ── check ────────────────────────────────────────────────────────────────────
if (args.includes('--check')) {
  const marker = readMarker(target);
  if (!marker || !Array.isArray(marker.files)) {
    console.error('not installed here (no valid manifest): ' + target);
    process.exit(2);
  }
  let hasError = false;
  if (marker.version !== pkg.version) {
    console.log(`DRIFT  version  : installed ${marker.version} != package ${pkg.version}`);
    hasError = true;
  }
  const missing = [];
  const drifted = [];
  for (const rel of marker.files) {
    const abs = path.join(target, rel);
    const src = path.join(srcSkill, rel);
    if (!fs.existsSync(abs)) { missing.push(rel); continue; }
    if (fs.existsSync(src) && sha256File(abs) !== sha256File(src)) drifted.push(rel);
  }
  if (missing.length) hasError = true;
  if (drifted.length) hasError = true;

  const managedSet = new Set(marker.files);
  const unmanaged = walkFiles(target).filter((rel) => !managedSet.has(rel) && !isBackup(rel));
  if (missing.length) console.log('MISSING managed files:');
  for (const rel of missing) console.log('  missing: ' + rel);
  if (drifted.length) console.log('MODIFIED since install:');
  for (const rel of drifted) console.log('  drift  : ' + rel);
  if (unmanaged.length) {
    console.log('NOTE unmanaged files kept in place (informational):');
    for (const rel of unmanaged) console.log('  extra  : ' + rel);
  }
  if (hasError) process.exit(1);
  console.log(`ok: ${marker.files.length} managed files match tech-lead-skill v${pkg.version}`);
  process.exit(0);
}

// ── install ──────────────────────────────────────────────────────────────────
const files = walkFiles(srcSkill);
console.log((dryRun ? '[dry-run] would install ' : 'installing ') +
  `${pkg.name} v${pkg.version} -> ${target} (${files.length} files)`);
for (const rel of files) {
  const dest = path.join(target, rel);
  if (dryRun) { console.log('  would write: ' + rel); continue; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  copyWithBackup(path.join(srcSkill, rel), dest);
}
if (!dryRun) {
  fs.writeFileSync(path.join(target, markerName), JSON.stringify({
    package: pkg.name,
    version: pkg.version,
    installedAt: new Date().toISOString(),
    files,
  }, null, 2) + '\n');
  console.log('installed: tech-lead-skill v' + pkg.version + ' -> ' + target);
} else {
  console.log('[dry-run] no changes written');
}
