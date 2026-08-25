'use strict';
// Hardening tests added after the four-way audit: traversal containment,
// directory-collision refusal, dry-run uninstall accounting.
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkgRoot = path.resolve(__dirname, '..');
const installJs = path.join(pkgRoot, 'bin', 'install.js');
const MARKER = '.tech-lead-skill.json';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'tls-hard-')); }
function run(args) {
  const res = execFileSync(process.execPath, [installJs, ...args], {
    encoding: 'utf8', cwd: pkgRoot, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return res; // stdout
}
function runAll(args) {
  const r = spawnSync(process.execPath, [installJs, ...args], {
    encoding: 'utf8', cwd: pkgRoot, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return (r.stdout || '') + (r.stderr || '');
}
function runFail(args) {
  try {
    return execFileSync(process.execPath, [installJs, ...args], {
      encoding: 'utf8', cwd: pkgRoot, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) { return err; }
}

test('uninstall ignores traversal entries planted in marker and keeps victim file', () => {
  const target = tmp();
  run(['--target', target]);
  const victimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-victim-'));
  const victim = path.join(victimDir, 'precious.txt');
  fs.writeFileSync(victim, 'do not delete');

  const marker = JSON.parse(fs.readFileSync(path.join(target, MARKER), 'utf8'));
  marker.files.push(path.relative(target, victim)); // e.g. ../../tls-victim-*/precious.txt
  fs.writeFileSync(path.join(target, MARKER), JSON.stringify(marker));

  const out = runAll(['--uninstall', '--target', target]);
  assert.match(out, /skipped unsafe manifest entry/);
  assert.strictEqual(fs.readFileSync(victim, 'utf8'), 'do not delete');
});

test('--check skips unsafe manifest entries instead of hashing outside target', () => {
  const target = tmp();
  run(['--target', target]);
  const marker = JSON.parse(fs.readFileSync(path.join(target, MARKER), 'utf8'));
  marker.files.push('../../outside-secret.txt');
  fs.writeFileSync(path.join(target, MARKER), JSON.stringify(marker));
  const out = runAll(['--check', '--target', target]);
  assert.match(out, /skipped unsafe manifest entry/);
});

test('install refuses when a managed destination is a directory (no partial tree)', () => {
  const target = tmp();
  fs.mkdirSync(path.join(target, 'SKILL.md')); // collision
  const err = runFail(['--target', target]);
  assert.ok(err && err.status === 2, 'must exit 2 with friendly refusal');
  const combined = (err.stdout || '') + (err.stderr || '');
  assert.match(combined, /destination exists as a directory/);
  // No partial install: SKILL.md must still be a directory, no marker written
  assert.ok(fs.statSync(path.join(target, 'SKILL.md')).isDirectory());
  assert.ok(!fs.existsSync(path.join(target, MARKER)));
});

test('dry-run uninstall reports accurate would-remove count and labels leftovers', () => {
  const target = tmp();
  run(['--target', target]);
  const out = runAll(['--uninstall', '--dry-run', '--target', target]);
  assert.match(out, /\[dry-run\] would remove \d+ managed entr/);
  const m = out.match(/would remove (\d+) managed entr/);
  assert.ok(Number(m[1]) >= 9, 'expected >=10 managed entries, got ' + m[1]);
  assert.match(out, /still present \(dry-run/);
  // zero writes
  assert.ok(fs.existsSync(path.join(target, MARKER)), 'marker must survive dry-run');
});
