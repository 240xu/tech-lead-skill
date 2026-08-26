import test from 'node:test';
import assert from 'node:assert/strict';
import { installAudit } from '../src/install.js';

const manifest = {
  version: '5.4.0',
  files: ['SKILL.md', 'templates/state.json', 'templates/intake.md'],
};

test('consistent install reports clean', () => {
  const r = installAudit(manifest, manifest.files, manifest.files, '5.4.0');
  assert.deepEqual(r.missingManaged, []);
  assert.deepEqual(r.unmanaged, []);
  assert.equal(r.versionMismatch, false);
});

test('missing managed and unmanaged extras detected; backups ignored', () => {
  const r = installAudit(
    manifest,
    ['SKILL.md', 'templates/intake.md', 'user-notes.txt', 'SKILL.md.bak-1720000000'],
    manifest.files,
    '5.4.0'
  );
  assert.deepEqual(r.missingManaged, ['templates/state.json']);
  assert.deepEqual(r.unmanaged, ['user-notes.txt']);
});

test('version mismatch flagged against package version', () => {
  const r = installAudit(manifest, manifest.files, manifest.files, '9.9.9');
  assert.equal(r.versionMismatch, true);
});

test('hostile primitive file lists degrade to empty sets instead of throwing', () => {
  const r = installAudit({ files: ['a'], version: '1' }, 'nope', 42, '1');
  assert.deepEqual(r.missingManaged, ['a']);
  assert.deepEqual(r.unmanaged, []);
  assert.deepEqual(r.newInPackage, []);
});
