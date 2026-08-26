#!/usr/bin/env node
/**
 * Assembles the single DSH-market package (@240xu/dsh-tech-lead) from the
 * internal workspace layers: core validators are inlined under src/core and
 * every cross-package import is rewritten to a relative path, so the published
 * artifact carries exactly one runtime dependency (@deepseek-ai/dsh-tools).
 */
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'packages', 'dsh-themis');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'src'), { recursive: true });

cpSync(join(root, 'packages/dsh-tech-lead-core/src'), join(out, 'src/core'), { recursive: true });
cpSync(join(root, 'packages/dsh-tech-lead-plugin/src'), join(out, 'src'), { recursive: true });

const CORE_SPEC = "from '@240xu/dsh-tech-lead-core'";
let rewritten = 0;
for (const rel of readdirSync(join(out, 'src'), { recursive: true })) {
  if (!rel.endsWith('.js')) continue;
  const file = join(out, 'src', rel);
  let text = readFileSync(file, 'utf8');
  if (text.includes(CORE_SPEC)) {
    const relSpec = relative(dirname(file), join(out, 'src', 'core', 'index.js')).split('\\').join('/');
    const spec = relSpec.startsWith('.') ? relSpec : './' + relSpec;
    text = text.replaceAll(CORE_SPEC, `from '${spec}'`);
    rewritten += 1;
  }
  writeFileSync(file, text);
}

writeFileSync(join(out, 'cordis.patch.yml'), readFileSync(join(root, 'packages/dsh-tech-lead-bundle/cordis.patch.yml'), 'utf8')
  .replace("name: '@240xu/dsh-tech-lead-plugin'", "name: 'dsh-themis'"));

const pkg = {
  name: 'dsh-themis',
  version: '1.0.0',
  description: 'Themis — tech-lead lifecycle governance for DeepSeek Harness: 21 read-only tools (classify/state/plan/evidence/gates/release/install audits, context/evidence/progress analysis, mutation preview). No writes, no subprocesses, no network.',
  license: 'MIT',
  type: 'module',
  main: 'src/index.js',
  exports: { '.': './src/index.js' },
  files: ['src/', 'cordis.patch.yml'],
  keywords: ['dsh', 'deepseek-harness', 'cordis', 'tech-lead', 'plugin', 'governance', 'themis'],
  publishConfig: { access: 'public' },
  repository: { type: 'git', url: 'git+https://github.com/240xu/tech-lead-skill.git', directory: 'packages/dsh-tech-lead' },
  dsh: { bundle: { patch: './cordis.patch.yml' } },
  dependencies: { '@deepseek-ai/dsh-tools': '0.1.0-rc.7' },
  engines: { node: '>=16' },
};
writeFileSync(join(out, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
console.log(`assembled packages/dsh-themis (${rewritten} files rewritten for inlined core)`);
