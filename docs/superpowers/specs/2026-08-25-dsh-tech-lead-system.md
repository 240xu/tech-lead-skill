# Tech Lead 系统化（Skill v5.4.1 + DSH 插件）设计规格

日期：2026-08-25 · 状态：已批准（同仓库 workspace 方案） · 分级：T2

## 1. 目标账本

| 项 | 内容 |
|---|---|
| Goal | 把 tech-lead Skill 的机械可判定规则固化为可安装的 DSH 只读工具链，并修复 Skill 安装器的安全缺陷 |
| Metric | 全部离线测试通过数 / 安装器缺陷关闭数 / 组合测试工具通过数 |
| Baseline | v5.3.0：安装器 3 个已确认缺陷；无机器校验；无 DSH 集成 |
| Target | 缺陷关闭；核心校验器与插件单测全绿；真实 Cordis 组合 21/21 工具 PASS；headless+web profile 加载成功 |
| Measure | `node tests/run-tests.js`、组合测试脚本、`dsh plugin --profile` 后的加载验证 |
| Deadline | 本会话内完成 Phase A–D；profile 实装在全部验证绿后执行 |
| Non-goal | 不做自动写入/自动安装/自动发布/子代理派发/网络/密钥读取能力；不改 DSH 核心；不重写 Skill 判断层 |

## 2. 资产分类与保护

- `SOURCE`：skill/、bin/、packages/*、tests/* — git diff + 提交粒度保护。
- `CONFIG`：~/.dsh/profiles/{web,headless}/package.json、cordis.patch.yml — 改前备份 `.bak-techlead-<ts>`，改后独立验证。
- `USER_DATA`：profile node_modules 由包管理器管理，不手改；用户技能目录 uninstall 时只删受管文件。
- `SECRET`：全程不涉及；任何 token 不进入本仓库。
- `RUNTIME`：dsh 进程不重启即不生效（HMR 已禁用）；安装后在下次启动生效。

## 3. 架构（四层）

```
tech-lead-skill/                 （根 = 可发布的 tech-lead-skill npm 包 + workspace 根）
├── bin/install.js               v5.4：manifest 精确、安全卸载、--check/--dry-run
├── skill/                       v5.4：SKILL.md + templates/（含 state.json）
├── tests/run-tests.js           安装器+校验器离线回归（node:test 或 assert 自举）
├── pnpm-workspace.yaml          packages/*
└── packages/
    ├── dsh-tech-lead-core/      纯函数库：classify/state/evidence/plan/gate/release/install/resume
    │   └── src/*.js  tests/*.test.js   ESM、零依赖、零 I/O
    ├── dsh-tech-lead-plugin/    Cordis 插件：ctx.tools.register 注册 21 个只读工具
    │   ├── src/index.js         named exports: name/inject/apply
    │   └── test/composition/    真实 Loader 组合测试（keyless）
    └── dsh-tech-lead-bundle/    bundle 层：cordis.patch.yml insert 一行 → 引用 plugin 包
        ├── cordis.patch.yml
        └── package.json         dsh.bundle.patch 指针 + 依赖 plugin
```

数据流：模型调用 tool → defineTool 参数校验 → core 纯函数 → 结果对象 → output.render 文本块。
工具只接受内联 JSON 入参（第一阶段），不做文件读取——保证零副作用边界可静态证明。

## 4. 接口契约

### 4.1 core 导出（全部纯函数，返回结构化结果，不 throw 业务失败）

```js
classify(input) -> { tier:'T0'|'T1'|'T2', reasons:string[], escalated:boolean }
// input: { touchesMultipleModules?, estimatedDays?, irreversibleOps?:string[],
//          protectedAssetTypes?:('SOURCE'|'USER_DATA'|'CONFIG'|'SECRET'|'RUNTIME'|'GENERATED')[],
//          publicInterfaceChange?, uncertainRisk? }
// 规则=SKILL §1.4：命中 USER_DATA/SECRET/RUNTIME/删除覆盖迁移/公共接口/不可逆 → T2；
// 多模块 → T2（同 SKILL §1.3）；≥1 天单模块 → T1；uncertainRisk 升一档。

validateState(raw) -> { valid, errors:[{path,message}], warnings, unknownFields }
// 枚举词表：mode∈{PLAN,EXECUTE}; tier∈{T0,T1,T2}; repository_mode∈{git,non-git,read-only};
// state_persistence∈{available,unavailable}(可选); last_outcome∈{CONTINUE,PAUSE,SCOPE-DOWN,PIVOT,STOP,''};
// phase 必填非空；schema_version 兼容数字 1 或字符串 "1"。
// schema v1：mode∈{PLAN,EXECUTE}; tier∈{T0,T1,T2}; last_outcome∈{CONTINUE,PAUSE,
// SCOPE-DOWN,PIVOT,STOP,''}; done[].anchor 必填; evidence[] 需 id/level(E0-E4)/source/
// time/scope/repro; updated_at 非空; unknown 字段→warning 不报错（保留语义）。

transitionCheck(state, proposed) -> { allowed, reason }
// 机械启发：PIVOT 需 decisions 非空；SCOPE-DOWN 需 goal_ledger+risks 非空；
// STOP 需 done.length>0 或 degraded_reason 非空；其余枚举外一律拒绝。

evidenceLint(evidence, opts{highRiskChange?}) -> findings[]
// 字段缺失/级别越界；highRiskChange 且最高引用级 ≤E2 → error。

planLint(plan) -> findings[]
// 必需 goal/metric/target；assumption 需 verification；decision 需 alternatives+reason；
// risk 需 impact+mitigation；dependency 需 blocker；irreversible 存在则 rollback 必填。

gatePrecheck(input) -> { pass, violations }
// input:{proposalAuthorId, executorId, reviewerIds[], solo?, blindRequired?,
//         destructiveScope?:string[], reports:[{reviewerId, verdict, anchors[]}]}
// 三分离：提案人/执行人不得任评审；每报告 ≥1 锚点；verdict∈{pass,conditional,reject}；
// solo 且 destructiveScope 非空 → 违例；blindRequired 需 ≥3 份独立锚点报告——注意：SKILL §6 要求四份（pm/arch/eng/ops），本实现机械下限取 3，属已声明偏差。

releaseAudit({allowlist, files, contentScan?}) -> violations
// EXTRA_FILE（白名单外）；contentScan 时正则扫泄漏疑似：
// 绝对家目录路径、sk-/ghp_/AKIA 前缀 token、bearer/password/token 赋值行 → LEAK_SUSPECT(带行号)。

installAudit(manifest{files,version}, actualFiles, pkgFiles, pkgVersion)
// -> { missingManaged, unmanaged, versionMismatch?, newInPackage[] }（newInPackage=当前包有而 marker 没有的文件；hashDrift 由 --check 在 install.js 内比对内容实现，core 只做集合差）

resumeCard(state, opts{now?,maxAgeDays?=7}) -> { position, lastGate, nextStep, staleEvidenceIds, warnings }
// maxAgeDays 默认 7 为本实现的证据过期策略（SKILL §7 未定义天数级阈值），非法值钳回默认并告警
```

### 4.2 plugin 工具表（只读）

| 工具名 | 入参要点 | 出参 |
|---|---|---|
| tech_lead_classify | classify 输入 | tier+reasons |
| tech_lead_state_validate | rawState（仅 JSON 字符串，非对象） | validateState 结果 |
| tech_lead_transition_check | state + proposed | transitionCheck |
| tech_lead_plan_lint | plan 对象的 JSON 字符串 | findings |
| tech_lead_evidence_lint | evidence[] 的 JSON 字符串 + highRiskChange | findings |
| tech_lead_gate_precheck | gatePrecheck 输入 | pass/violations |
| tech_lead_release_audit | allowlist+files[]+contentScan | violations |
| tech_lead_install_audit | manifest/actual/pkg | audit 结果 |
| tech_lead_resume_card | state | resumeCard |
| tech_lead_context_validate | context snapshot | ContextSnapshot 校验 |
| tech_lead_evidence_graph_lint | context snapshot | 证据引用图校验 |
| tech_lead_evidence_freshness | context + options | 陈旧证据/指纹漂移 |
| tech_lead_assumption_register | context snapshot | 假设验证就绪度 |
| tech_lead_progress_decide | context + options | 推进/暂停建议 |
| tech_lead_critical_path | tasks + dependencies | 依赖/循环/并行窗口 |
| tech_lead_change_impact | change + context | T0/T1/T2 影响分类 |
| tech_lead_resume_reconcile | previous + current | 快照漂移 |
| tech_lead_gate_plan | impact + context | 角色/证据/quorum 计划 |
| tech_lead_gate_aggregate | reports + plan | 锚点评审聚合 |
| tech_lead_gate_reopen | previous + current | Gate 重开判断 |
| tech_lead_mutation_preview | MutationIntent | 只读预览，执行路径拒绝 |

入参格式约定（DSH schema 限制）：复合输入一律为 JSON 字符串、列表输入为 CSV——工具不做嵌套对象入参；
该取舍与 §3「只接受内联 JSON」一致，§4.2 表格中任何「对象」字样以本句为准。

**双契约说明**：前九个遗留工具保持其原始响应形状（裸校验结果/违规数组等，无 ResultEnvelope 包装），
以兼容既有调用方；后十二个强化工具统一返回 ResultEnvelope v1。两类工具的入参解析层共享
`src/protocol.js`（parseJsonString/parseJsonFields/renderEnvelope/runGuarded），BAD_INPUT 错误项
形状一致（{code,path,message}）；意外异常经 runGuarded 转换为 INTERNAL envelope，不向模型泄漏堆栈或路径。

导出形状：`export const name='tech-lead-tools'; export const inject=['tools']; export function apply(ctx)`，
内部对每个工具 `ctx.tools.register(defineTool({...}))`。output.render 输出 `[{"type":"text","text":...}]`。

### 4.3 bundle

package.json 含 `"dsh":{"bundle":{"patch":"./cordis.patch.yml"}}` 与依赖 `@240xu/dsh-tech-lead-plugin`。
cordis.patch.yml：

```yaml
- insert:
    - id: tech-lead-tools
      name: '@240xu/dsh-tech-lead-plugin'
```

接入方式（插件市场）：`dsh plugin --profile <name> add dsh-themis`（**单一自包含包**， Themis＝秩序女神；由 `scripts/build-market-package.mjs` 从 workspace 三层装配内联生成，唯一运行时依赖 @deepseek-ai/dsh-tools；历史包名 @240xu/dsh-tech-lead 及更早拆分三包均已 deprecate 指向现名。）源码备选：装配后 `dsh plugin add <本地路径>`；CLI 自动写 profile package.json 的
dsh.profile.bundles 并跑 pnpm）。顺序：先建隔离 profile `techtest` → headless → web。

## 5. 权限矩阵（铁律）

| 动作 | 允许 | 条件 |
|---|---|---|
| 工具读取入参 JSON 并计算 | ✅ 默认 | 无 |
| 写任意文件 / 执行命令 / 网络 / 密钥读取 | ❌ 永不 | 第一阶段无此代码路径 |
| 修改 profile 配置 | ❌ 插件内禁止 | 仅由人工经 `dsh plugin add` 完成 |
| 未来写入类工具（prepare_state 等） | 二期 | 单独审批门 + approval 事件集成，本规格不实现 |

## 6. 测试与验收

1. **Phase A**：`node tests/run-tests.js` 覆盖：安装全集（含 state.json）、重复安装备份、
   marker.files==实际、--check 漂移检测、安全卸载保留外来文件与 .bak、--dry-run 无写入、
   validateState 合法/非法 fixture。全绿才进 B。
2. **Phase B/C**：core 每函数 ≥3 用例（正常/违例/边界）node:test；plugin 组合测试经真实
   Loader（根 devDependencies 解析 cordis/cordis-plugin-loader/include/dsh-system-prompt，
   经 `npm run test:composition` 启动，不依赖全局 DSH 安装路径）驱动 21 个正例 +
   12 个 BAD_INPUT 负例，打印 `TLT-PASS n/21` 与 `TLT-NEG n/12`。
3. **Phase D**：techtest profile 启动加载成功（工具出现在注册日志/driver 断言），随后
   headless、web 同样验证；每次改 profile 前备份配置。
4. 回滚点：每个 Phase 一个 commit；profile 改动有 .bak-techlead-<ts>。

## 7. 已知限制（记录不解决）

- 组合测试 driver 是接线冒烟：21 正例 + 12 BAD_INPUT 负例；恒错响应不会误过，但恒对桩理论上可骗过。
- context 校验只到字段级：goalLedger 等集合的元素级形状检查委托给 evidence_graph_lint / planLint 等专项 lint，不在 validateContext 内重复。
- ~~前九个遗留工具无专属 plugin 单测~~ 已闭合：test/legacy-tools.test.js 以 9 个特征化回归钉覆盖正例与各自 JSON 解析降级形状。
- mutation 标记扫描按 Unicode 语义匹配 `apply|execute|deploy`；同形字/ZWSP/全角混淆可绕过字符串扫描，但 preview 模式无任何执行汇（capability 完整性不受影响），仅决策支持层需知悉。
- 输出放大已在工具层封顶（双门限）：findings/error 每字段 ≤500 条（附 FINDINGS_TRUNCATED）；回显键（evidence/targets/expectedDiff/verification/items）>100 折叠为 {truncated,total}；data 下其余数组 >1000 保形头切；深层 >64 级子树折叠为 DEPTH_LIMIT 哨兵（原生 stringify 在本机 V8 于 ~6k 层亦会溢出，透传不可依赖）；>256KB 紧凑序列化。遗留裸顶层数组 500 处静默切片。核心层保持完整确定性结果不变。
- gateAggregate 角色满足度判定已由 O(roles×reports) 优化为 Set 查表 O(n+m)。
- 出厂工件纳入测试射程：tests/artifact-smoke.test.js 直载 packages/dsh-themis/src 执行 6 组关键行为探针（21 工具数、信封元数据权威、dup-role reject、未来证据判陈旧、大小写拒绝+扫描深度窗、标量漂移键），装配突变不再能无感上线；构建脚本内置残留 @240xu/ 说明符守卫与 yml 替换断言，并随包发布 README。
- 前九个遗留工具假定入参为对象（DSH harness 保证 args 为对象）；绕过 harness 直接以 undefined 调用属库级误用。
- 离线测试套件需 Node ≥18（node:test CLI）；运行时包本身 engines ≥16 即可。

- 工具第一阶段不读文件系统：模型需粘贴 state/文件清单内容（换取可证明零副作用）。
- transition/gate 规则是 §4.8/§5/§6 的机械子集，不是完整语义。
- npm 发布 @240xu scope 未定：若 dsh-tools 无法从 registry 解析，plugin 以 file: 依赖接入
  profile（web profile 已有 file: 先例），GitHub tag 作为分发锚点。
