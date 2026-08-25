import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseAudit } from '../src/release.js';

const allowlist = ['README.md', 'skill/SKILL.md'];

test('whitelisted clean files pass with contentScan on', () => {
  const v = releaseAudit({
    allowlist,
    files: [
      { path: 'README.md', content: '# Tech Lead Skill\n\nInstall with npx.' },
      { path: 'skill/SKILL.md', content: '## §7 状态落盘\n' },
    ],
  });
  assert.deepEqual(v, []);
});

test('non-whitelisted file is EXTRA_FILE', () => {
  const v = releaseAudit({
    allowlist,
    files: [{ path: 'secret-notes.txt', content: '' }],
  });
  assert.equal(v.length, 1);
  assert.equal(v[0].type, 'EXTRA_FILE');
});

test('leak patterns detected with line numbers', () => {
  const v = releaseAudit({
    allowlist,
    contentScan: true,
    files: [{
      path: 'README.md',
      content: [
        'line1 ok',
        'backup at /data/data/com.termux/files/home/x',
        'key = sk-abcdef12345678',
        'github token ghp_' + 'A'.repeat(24),
        'Authorization: bearer abcdefghijk12345',
        'db password=hunter22 secret',
      ].join('\n'),
    }],
  });
  const types = v.map((x) => x.type);
  assert.ok(types.includes('ABS_PATH'));
  assert.ok(types.includes('TOKEN_SUSPECT'));
  assert.ok(types.includes('CREDENTIAL_LINE'));
  assert.ok(v.every((x) => typeof x.line === 'number' && x.line >= 1));
});

test('scan can be disabled', () => {
  const v = releaseAudit({
    allowlist,
    contentScan: false,
    files: [{ path: 'README.md', content: 'password=whatever123' }],
  });
  assert.deepEqual(v, []);
});
