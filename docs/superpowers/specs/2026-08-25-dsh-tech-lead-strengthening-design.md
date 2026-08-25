# DSH Tech Lead 强化版设计规格

日期：2026-08-25
状态：已批准，Phase M0-M5 已实现并验证
分级：T2
基线：Skill v5.4.2 / DSH plugin v0.2.0

## 1. 目标账本

| 项 | 内容 |
|---|---|
| Goal | 把 DSH tech-lead 插件从 9 个独立校验工具强化为可组合、可续跑、证据驱动的工程治理运行时，同时保持第一阶段零副作用 |
| User outcome | DSH 能够先建立任务上下文，再按风险和证据推进计划、Gate、验证和恢复，而不是只对单个 JSON 做孤立检查 |
| Metrics | 组合工作流覆盖率、无效输入安全返回率、状态/证据漂移检测率、关键路径识别准确性、跨 profile 组合测试通过率 |
| Baseline | 9 个只读工具；工具之间没有统一上下文；没有证据过期/漂移编排；组合测试仅验证单次调用 |
| Target | 形成 v0.2 强化内核：统一 envelope、上下文快照、证据图、推进建议、Gate 聚合、关键路径与 resume 漂移检查；全量离线测试与真实 DSH 组合测试保持全绿 |
| Measure | `node tests/run-tests.js`、core 单测、plugin contract tests、composition workflow tests、静态副作用扫描、npm pack 审计 |
| Stop | 任一安全边界被破坏、核心接口无法保持纯函数、组合层无法在隔离 profile 稳定加载，或新增复杂度不能被测试和证据覆盖 |

## 2. 分阶段范围

### Phase 0：基线冻结与契约层

目标：不改变现有 9 个工具的行为，建立统一版本、错误、结果和能力描述协议。

产出：

- `ResultEnvelope v1`：统一 `ok/code/data/errors/warnings/meta`。
- `ContextSnapshot v1`：统一任务上下文输入，不读文件、不持久化。
- 工具能力目录：名称、版本、风险、输入限制、是否纯函数。
- 旧工具输出兼容适配层（保留在 tools.js 内联注册，未拆分独立 basic.js 模块），避免一次性破坏现有 DSH 调用方。

### Phase 1：上下文与证据强化

目标：把孤立检查提升为基于同一上下文的组合分析。

产出：

- `context_validate`：校验目标、约束、非目标、资产、假设、依赖和当前阶段。
- `evidence_graph_lint`：校验证据与目标、风险、决策、Gate 的引用关系。
- `evidence_freshness`：按时间、范围、复现方式和环境指纹判断证据是否仍有效。
- `assumption_register`：只读计算假设优先级、验证动作和受影响条目。

### Phase 2：推进与关键路径

目标：让插件能回答“现在应该继续做什么，以及为什么”。

产出：

- `progress_decide`：根据上下文、证据、Gate、风险和依赖给出 `CONTINUE / PAUSE / SCOPE-DOWN / PIVOT / STOP` 建议。
- `critical_path`：计算阻塞项、解除阻塞价值和可安全并行窗口。
- `change_impact`：计算变更影响面、资产类别、可逆性和需要重开的 Gate。
- `resume_reconcile`：比较历史 resume 状态与当前快照，报告漂移和需要降级的结论。

### Phase 3：Gate 编排与多视角聚合

目标：把现有 gate precheck 从单次前置校验提升为完整的评审聚合器。

产出：

- `gate_plan`：根据影响面生成所需评审角色、最低证据等级和通过条件。
- `gate_aggregate`：聚合 PM/Arch/Eng/Ops 报告，去重问题，传播否决和条件项。
- `gate_reopen`：当上下文、证据、依赖或代码快照发生漂移时识别需要重开的 Gate。
- 盲评报告 schema、锚点约束、裁决表和争议回炉原因。

### Phase 4：受控写入预留，不默认启用

目标：为未来写入能力稳定接口，但本阶段不允许真实副作用。

产出：

- `MutationIntent v1`：描述目标文件、预期 diff、恢复点、验证命令和授权范围。
- `preview_mutation`：只生成变更计划，不写文件、不执行命令。
- `approval_required`：返回需要人工确认的结构化请求。
- 明确的 capability flag，默认 `read-only`；没有审批事件时写入路径必须不可达。

## 3. 架构

```text
DSH tool call
    |
    v
plugin adapter  ---- capability catalog / input normalization
    |
    v
orchestration layer ---- context / evidence / progress / gate / reconcile
    |
    v
pure core reducers ---- deterministic structured results, never throw business errors
    |
    v
ResultEnvelope v1 ---- text renderer for DSH
```

### 3.1 Core 层

`packages/dsh-tech-lead-core/src/` 继续保持 ESM、零依赖、零 I/O、纯函数。新增模块按职责拆分：

- `envelope.js`：结果包装、错误码和 warning 合并。
- `context.js`：上下文 schema 与最小字段校验。
- `evidence-graph.js`：引用图、孤立证据、缺失支持和循环关系检查。
- `progress.js`：状态建议和停止原因。
- `critical-path.js`：依赖图计算和并行窗口。
- `impact.js`：资产、影响面、可逆性与 Gate 重开判定。
- `reconcile.js`：历史快照与当前快照的纯差异计算。
- `capabilities.js`：工具目录和能力声明。

现有 `classify/state/evidence/plan/gate/release/install/resume` 作为稳定基础模块保留；新模块通过 index 导出，避免把所有逻辑继续堆进 `tools.js`。

### 3.2 Plugin 层

`packages/dsh-tech-lead-plugin/src/` 按领域拆分工具定义：

- `tools/basic.js`：现有 9 个工具的注册入口。
- `tools/context.js`：上下文、证据图和假设工具。
- `tools/progress.js`：推进、关键路径、影响和 reconcile 工具。
- `tools/gates.js`：Gate plan/aggregate/reopen 工具。
- `tools/mutation.js`：只读 mutation intent/preview 工具。
- `protocol.js`：JSON 字符串解析、CSV 规范化、envelope 输出。
- `index.js`：注册域工具、导出能力目录、保持现有 bundle 入口不变。

每个工具必须：

- 只接收 DSH 可稳定表达的 primitive 或 JSON string。
- 对输入解析失败返回 `BAD_INPUT`，不得 throw。
- 返回统一 JSON string envelope。
- 不访问 `fs`、`child_process`、网络、环境秘密或 DSH 外部执行器。

### 3.3 Bundle 层

`dsh-tech-lead-bundle` 保持一行 patch 的最小接入方式。能力扩展通过 plugin 包内部注册，不在 profile patch 中复制工具逻辑。bundle 版本与 plugin/core 版本建立明确兼容矩阵。

## 4. 统一协议

### 4.1 ResultEnvelope v1

```js
{
  ok: true,
  code: "OK",
  data: {},
  errors: [],
  warnings: [],
  meta: {
    schema: "tech-lead.result.v1",
    operation: "progress_decide",
    deterministic: true,
    sideEffects: false
  }
}
```

失败也必须返回同一形状：`ok:false`，错误使用稳定 code，例如 `BAD_INPUT`、`SCHEMA_INVALID`、`STALE_EVIDENCE`、`GATE_BLOCKED`、`DRIFT_DETECTED`、`CAPABILITY_DENIED`。

### 4.2 ContextSnapshot v1

```js
{
  schema: "tech-lead.context.v1",
  project: { id, name, repositoryMode },
  goalLedger: [],
  nonGoals: [],
  constraints: [],
  assets: [],
  assumptions: [],
  decisions: [],
  risks: [],
  dependencies: [],
  evidence: [],
  gates: [],
  current: { mode, tier, phase, lastOutcome, nextStep },
  snapshot: { at, source, fingerprint }
}
```

第一阶段 `source` 只能是 `inline`；`fingerprint` 由调用方提供或由纯函数对规范化输入计算，不代表插件读取了环境。

### 4.3 MutationIntent v1

```js
{
  schema: "tech-lead.mutation-intent.v1",
  mode: "read-only-preview",
  target: [{ path, assetType, operation }],
  expectedDiff: [],
  recoveryPoint: { required: true, description },
  verification: [{ command, expected }],
  authorization: { required: true, status: "missing" }
}
```

任何 `mode` 不是 `read-only-preview` 的值都必须返回 `CAPABILITY_DENIED`；第一阶段不实现真实 apply。

## 5. 安全与权限

| 能力 | Phase 0-3 | Phase 4 预留 |
|---|---:|---:|
| 读取调用方内联 JSON | 允许 | 允许 |
| 纯函数计算 | 允许 | 允许 |
| 读取文件系统 | 禁止 | 需单独能力 |
| 写入文件 | 禁止 | 审批后仍需单独实现 |
| 执行命令 | 禁止 | 审批后仍需独立执行器 |
| 网络访问 | 禁止 | 默认禁止 |
| 读取秘密 | 永久禁止 | 永久禁止 |
| 修改 DSH profile | 永久禁止 | 永久禁止 |

静态安全 Gate 必须扫描：`fs`、`child_process`、`process.env`、网络客户端、动态 import 路径、危险全局、隐式命令执行和工具注册参数中的副作用描述。

## 6. 测试策略

### Core

- 每个新增纯函数至少覆盖：正常、结构违例、边界、组合冲突、不可用输入。
- 性质测试重点：无论输入顺序如何，规范化结果稳定；坏输入不 throw；只读模块不产生外部调用。
- 依赖图测试覆盖环、孤立节点、多根、并行窗口和未知依赖。

### Plugin

- 工具契约测试：参数 schema、统一 envelope、错误码、文本 render。
- 工具组合测试：`context → evidence → progress → gate → reconcile`。
- 负向对照：恒错输入、缺字段、错误 schema、伪造高等级证据、身份冲突、漂移快照。
- 组合驱动器必须证明错误结果不会被误判为成功。

### Runtime

- `techtest`、`headless`、`web` 三 profile 各完成加载验证。
- 运行时扫描插件源码，禁止副作用 API。
- `npm pack --dry-run`、发布集扫描、版本兼容矩阵和远端/本机文件清单检查。

## 7. 里程碑与门禁

| 里程碑 | 交付 | Gate |
|---|---|---|
| M0 | 契约层与版本冻结 | 旧 9 工具行为回归全绿；ResultEnvelope 全量覆盖 |
| M1 | Context + Evidence Graph | 上下文 schema、证据引用和过期判断测试全绿 |
| M2 | Progress + Critical Path | 状态建议、依赖阻塞和并行窗口组合测试全绿 |
| M3 | Gate Orchestration | 多角色聚合、否决传播、重开测试全绿 |
| M4 | Mutation Preview | 只读预览和 CAPABILITY_DENIED 测试全绿；无真实写入路径 |
| M5 | Profile/发布收尾 | 三 profile、包面、静态安全和文档审计全绿 |

每个里程碑独立 commit。任何安全 Gate 失败立即回炉，不以增加测试数量替代修复契约问题。

## 8. 明确不做的事情

- 不把 Skill 的判断层全文搬入插件。
- 不让插件自动读取项目文件来“猜测”状态。
- 不让插件自行执行 Shell、部署、迁移、Git、网络请求或秘密读取。
- 不为追求工具数量而增加低频、无法验证的工具。
- 不在没有真实需求和审批协议前实现自动写入。
- 不把一次局部组合测试通过宣传为真实项目目标已达成。

## 9. 当前第一步

先实现 Phase 0：在不改变业务规则的情况下引入统一协议、模块化注册入口、能力目录和旧工具兼容测试。Phase 0 通过后再进入 Context/Evidence，不跨阶段混改。

本规格是强化版的设计基线；用户复核通过后，再写对应实施计划并开始 TDD。
