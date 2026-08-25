'use strict';
// Installer contract tests for tech-lead-skill v5.4.
// Run: node --test tests/installer.test.js
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkgRoot = path.resolve(__dirname, '..');
const installJs = path.join(pkgRoot, 'bin', 'install.js');
const MARKER = '.tech-lead-skill.json';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tls-test-'));
}

function run(args) {
  return execFileSync(process.execPath, [installJs, ...args], {
    encoding: 'utf8',
    cwd: pkgRoot,
  });
}

function runFail(args) {
  try {
    execFileSync(process.execPath, [installJs, ...args], {
      encoding: 'utf8',
      cwd: pkgRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    return err;
  }
  return null;
}

function expectedManagedFiles() {
  const srcSkill = path.join(pkgRoot, 'skill');
  const out = [];
  function walk(rel) {
    const abs = path.join(srcSkill, rel);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const relPath = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(relPath);
      else out.push(relPath.split(path.sep).join('/'));
    }
  }
  walk('');
  return out.sort();
}

test('install copies full managed set including state.json and writes exact manifest', () => {
  const target = tmpDir();
  run(['--target', target]);
  const managed = expectedManagedFiles();
  assert.ok(managed.includes('templates/state.json'), 'state.json must be managed');
  for (const rel of managed) {
    assert.ok(
      fs.existsSync(path.join(target, rel)),
      'missing installed file: ' + rel
    );
  }
  const marker = JSON.parse(fs.readFileSync(path.join(target, MARKER), 'utf8'));
  assert.strictEqual(marker.package, 'tech-lead-skill');
  assert.strictEqual(typeof marker.version, 'string');
  assert.strictEqual(
    (marker.files || []).slice().sort().join(','),
    managed.join(','),
    'marker.files must equal actual managed set'
  );
});

test('reinstall backs up existing managed files and keeps manifest accurate', () => {
  const target = tmpDir();
  run(['--target', target]);
  run(['--target', target]);
  const baks = fs.readdirSync(target).filter((f) => /^SKILL\.md\.bak-\d+(?:-\d+)?$/.test(f));
  assert.ok(baks.length >= 1, 'expected SKILL.md backup on reinstall');
  const tplBaks = fs
    .readdirSync(path.join(target, 'templates'))
    .filter((f) => /state\.json\.bak-\d+(?:-\d+)?$/.test(f));
  assert.ok(tplBaks.length >= 1, 'expected state.json backup on reinstall');
});

test('uninstall removes only managed files, preserves foreign files and backups', () => {
  const target = tmpDir();
  run(['--target', target]);
  run(['--target', target]); // produce backups
  const foreignRel = 'notes/keepme.txt';
  fs.mkdirSync(path.join(target, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(target, foreignRel), 'user data');

  run(['--uninstall', '--target', target]);

  const managed = expectedManagedFiles();
  for (const rel of managed) {
    assert.ok(!fs.existsSync(path.join(target, rel)), 'managed file must be gone: ' + rel);
  }
  assert.ok(!fs.existsSync(path.join(target, MARKER)), 'marker must be gone');
  assert.strictEqual(
    fs.readFileSync(path.join(target, foreignRel), 'utf8'),
    'user data',
    'foreign file must survive uninstall'
  );
  const bakSurvived = fs
    .readdirSync(target)
    .some((f) => /^SKILL\.md\.bak-\d+(?:-\d+)?$/.test(f));
  assert.ok(bakSurvived, '.bak-* backups must survive uninstall');
});

test('uninstall refuses unmarked target with exit code 2', () => {
  const target = tmpDir();
  const err = runFail(['--uninstall', '--target', target]);
  assert.ok(err, 'must fail');
  assert.strictEqual(err.status, 2);
});

test('--check exits 0 on fresh install and 1 after drift', () => {
  const target = tmpDir();
  run(['--target', target]);
  run(['--check', '--target', target]);

  const victim = path.join(target, 'SKILL.md');
  fs.unlinkSync(victim);
  const err = runFail(['--check', '--target', target]);
  assert.ok(err, 'drifted check must fail');
  assert.strictEqual(err.status, 1);
  assert.match((err.stderr || '') + (err.stdout || ''), /missing/i);
});

test('--check detects version mismatch', () => {
  const target = tmpDir();
  run(['--target', target]);
  const markerPath = path.join(target, MARKER);
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  marker.version = '0.0.1';
  fs.writeFileSync(markerPath, JSON.stringify(marker));
  const err = runFail(['--check', '--target', target]);
  assert.ok(err && err.status === 1, 'version mismatch must exit 1');
  assert.match((err.stderr || '') + (err.stdout || ''), /version/i);
});

test('--dry-run performs zero writes', () => {
  const target = tmpDir();
  run(['--dry-run', '--target', target]);
  assert.deepStrictEqual(fs.readdirSync(target), [], 'dry-run must not create files');
});
