const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('packages');
const forbidden = [
  /from\s+['"](?:node:)?fs['"]/, /from\s+['"](?:node:)?child_process['"]/, /from\s+['"](?:node:)?(?:net|http|https)['"]/, /process\.env/, /\b(?:exec|spawn|fork)Sync\s*\(/, /\bfetch\s*\(/,
];

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : full.endsWith('.js') ? [full] : [];
  });
}

test('core and plugin source contain no runtime side-effect APIs', () => {
  const violations = [];
  for (const file of [...files(path.join(root, 'dsh-tech-lead-core/src')), ...files(path.join(root, 'dsh-tech-lead-plugin/src'))]) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of forbidden) if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
  }
  assert.deepEqual(violations, []);
});
