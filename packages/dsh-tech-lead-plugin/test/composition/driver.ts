import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import { CallId } from '@deepseek-ai/dsh-llm'

const validState = {
  schema_version: 1,
  mode: 'EXECUTE',
  tier: 'T2',
  phase: 'M1',
  repository_mode: 'git',
  done: [{ item: 'core validators', anchor: 'commit:5b2c622' }],
  evidence: [{
    id: 'E-1', level: 'E2', source: 'node --test',
    time: '2026-08-25T00:00:00Z', scope: 'core', repro: 'cd packages/dsh-tech-lead-core && node --test tests/',
  }],
  last_outcome: 'CONTINUE',
  next_step: 'composition test',
  updated_at: '2026-08-25T00:00:00Z',
}

interface Case {
  tool: string
  args: Record<string, unknown>
  expect: (result: any) => boolean
}

const cases: Case[] = [
  {
    tool: 'tech_lead_classify',
    args: { touchesMultipleModules: true },
    expect: (r) => r.tier === 'T2',
  },
  {
    tool: 'tech_lead_state_validate',
    args: { stateJson: JSON.stringify(validState) },
    expect: (r) => r.valid === true,
  },
  {
    tool: 'tech_lead_transition_check',
    args: {
      stateJson: JSON.stringify({ decisions: [], goal_ledger: [], risks: [], done: [], degraded_reason: '' }),
      proposed: 'PIVOT',
    },
    expect: (r) => r.allowed === false,
  },
  {
    tool: 'tech_lead_plan_lint',
    args: { planJson: JSON.stringify({ goal: 'g', assumptions: [] }) },
    expect: (r) => Array.isArray(r) && r.some((f: any) => f.path === 'metric'),
  },
  {
    tool: 'tech_lead_evidence_lint',
    args: {
      evidenceJson: JSON.stringify([{
        id: 'A', level: 'E2', source: 's', time: 't', scope: 'sc', repro: 'r',
      }]),
      highRiskChange: true,
    },
    expect: (r) => Array.isArray(r) && r.some((f: any) => f.severity === 'error'),
  },
  {
    tool: 'tech_lead_gate_precheck',
    args: { inputJson: JSON.stringify({ solo: true, destructiveScope: ['prod-db'] }) },
    expect: (r) => r.pass === false && r.violations.some((v: any) => v.type === 'SOLO_FORBIDDEN'),
  },
  {
    tool: 'tech_lead_release_audit',
    args: { allowlistCsv: 'README.md', filesJson: JSON.stringify([{ path: 'extra.txt' }]) },
    expect: (r) => Array.isArray(r) && r[0]?.type === 'EXTRA_FILE',
  },
  {
    tool: 'tech_lead_install_audit',
    args: {
      manifestJson: JSON.stringify({ version: '5.4.0', files: ['SKILL.md'] }),
      actualFilesCsv: 'user-notes.txt',
      pkgFilesCsv: 'SKILL.md',
      pkgVersion: '5.4.0',
    },
    expect: (r) => r.unmanaged.includes('user-notes.txt') && !r.versionMismatch,
  },
  {
    tool: 'tech_lead_resume_card',
    args: { stateJson: JSON.stringify(validState), nowIso: '2026-08-25T01:00:00Z' },
    expect: (r) => r.position.includes('M1') && r.nextStep === 'composition test',
  },
]

export const name = 'tech-lead-composition-driver'
export const inject = ['tools']

export function apply(ctx: Context) {
  void (async () => {
    let pass = 0
    const failures: string[] = []
    for (const c of cases) {
      try {
        const result = await ctx.tools.execute({
          callId: CallId(`drv-${c.tool}`),
          name: c.tool,
          arguments: c.args,
          signal: new AbortController().signal,
        })
        const text = result.content.map((b: any) => (b.type === 'text' ? b.text : '')).join('')
        let parsed: any = text
        try { parsed = JSON.parse(text) } catch {}
        if (c.expect(parsed)) {
          pass++
          console.log(`PASS ${c.tool}`)
        } else {
          failures.push(c.tool)
          console.log(`FAIL ${c.tool}: ${text.slice(0, 300)}`)
        }
      } catch (err) {
        failures.push(c.tool)
        console.log(`FAIL ${c.tool}: threw ${(err as Error).message}`)
      }
    }
    console.log(`TLT-PASS ${pass}/${cases.length}`)
    if (failures.length) console.log('TLT-FAILURES ' + failures.join(','))
    setTimeout(() => process.exit(failures.length ? 1 : 0), 50)
  })()
}
