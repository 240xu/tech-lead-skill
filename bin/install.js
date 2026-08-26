#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const pkgRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
const srcSkill = path.join(pkgRoot, 'skill');
const markerName = '.tech-lead-skill.json'; // marker name is legacy-stable across the nomos-skill rebrand
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
    `nomos-skill ${pkg.version}\n` +
    'Usage: nomos-skill [options]\n' +
    '  (no args)         install into ~/.config/opencode/skills/tech-lead\n' +
    '  --target <dir>    install into <dir>\n' +
    '  --check           verify installed files match this package\n' +
    '  --dry-run         print planned actions without writing anything\n' +
    '  --uninstall       remove only manifest-managed files (keeps user files)\n' +
    '  --version         print version\n' +
    '  --help            show this help\n' +
    '\n' +
    'Exit codes: 0 ok, 1 drift detected (--check), 2 usage/refusal error'
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
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); }
    catch (err) { console.warn('warn: cannot read ' + abs + ' (' + err.code + '), skipping'); return; }
    for (const entry of entries) {
      const relPath = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(relPath);
      else out.push(relPath.split(path.sep).join('/'));
    }
  })('');
  return out.sort();
}

function isBackup(rel) {
  return /\.bak-\d+(?:-\d+)?$/.test(rel);
}

function readMarker(target) {
  try {
    return JSON.parse(fs.readFileSync(path.join(target, markerName), 'utf8'));
  } catch (_) {
    return null;
  }
}

// A manifest entry may only address paths INSIDE target: blocks traversal via
// tampered marker.files ("../x", absolute paths resolve under target anyway).
function containedRel(target, rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0')) return null;
  const abs = path.resolve(target, rel);
  const base = path.resolve(target);
  const relCheck = path.relative(base, abs);
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) return null;
  return relCheck.split(path.sep).join('/');
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyWithBackup(src, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).isDirectory()) {
    console.error('refusing: destination exists as a directory: ' + dest);
    console.error('remove or rename it, then re-run the installer');
    process.exit(2);
  }
  if (fs.existsSync(dest)) {
    const bak = dest + '.bak-' + Date.now() + '-' + process.pid;
    fs.copyFileSync(dest, bak);
    console.log('backup : ' + bak);
  }
  fs.copyFileSync(src, dest);
}

function isHomeDir(dir) {
  try { return fs.realpathSync(dir) === fs.realpathSync(os.homedir()); }
  catch (_) { return false; }
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
  let wouldRemove = 0;
  for (const raw of marker.files) {
    const rel = containedRel(target, raw);
    if (!rel) { console.warn('skipped unsafe manifest entry: ' + JSON.stringify(raw)); continue; }
    const abs = path.join(target, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      console.warn('skipped directory entry (not managed): ' + rel);
      continue;
    }
    dirsTouched.add(path.dirname(abs));
    if (dryRun) { console.log('would remove: ' + abs); wouldRemove++; continue; }
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
    console.log(dryRun ? 'still present (dry-run; includes managed files):' : 'kept (not managed):');
    for (const rel of leftovers) console.log('  kept   : ' + rel);
  } else if (!dryRun && !isHomeDir(target)) {
    try { fs.rmdirSync(target); console.log('removed empty target directory'); } catch (_) { /* keep */ }
  }
  const count = dryRun ? wouldRemove : removed;
  console.log((dryRun ? '[dry-run] would remove ' : 'removed ') + count + ' managed entr' + (count === 1 ? 'y' : 'ies'));
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
  const orphaned = [];
  for (const raw of marker.files) {
    const rel = containedRel(target, raw);
    if (!rel) { console.warn('skipped unsafe manifest entry: ' + JSON.stringify(raw)); continue; }
    const abs = path.join(target, rel);
    const src = path.join(srcSkill, rel);
    if (!fs.existsSync(abs)) { missing.push(rel); continue; }
    if (!fs.existsSync(src)) { orphaned.push(rel); continue; }
    if (sha256File(abs) !== sha256File(src)) drifted.push(rel);
  }
  if (missing.length) hasError = true;
  if (drifted.length) hasError = true;
  if (orphaned.length) hasError = true;

  const managedSet = new Set(marker.files);
  const unmanaged = walkFiles(target).filter((rel) => !managedSet.has(rel) && !isBackup(rel) && rel !== markerName);
  if (missing.length) console.log('MISSING managed files:');
  for (const rel of missing) console.log('  missing: ' + rel);
  if (orphaned.length) console.log('ORPHANED managed files absent from current package:');
  for (const rel of orphaned) console.log('  orphan : ' + rel);
  if (drifted.length) console.log('MODIFIED since install:');
  for (const rel of drifted) console.log('  drift  : ' + rel);
  if (unmanaged.length) {
    console.log('NOTE unmanaged files kept in place (informational):');
    for (const rel of unmanaged) console.log('  extra  : ' + rel);
  }
  if (hasError) process.exit(1);
  console.log(`ok: ${marker.files.length} managed files match nomos-skill v${pkg.version}`);
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
  console.log('installed: nomos-skill v' + pkg.version + ' -> ' + target);
} else {
  console.log('[dry-run] no changes written');
}
