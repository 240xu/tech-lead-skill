# Tech Lead Skill

[English](README.md) | 简体中文

一套以证据驱动的规划与交付技能，适用于软件、基础设施、研究、逆向工程与运维类工作。

## 解决什么问题

计划失败通常有两种方式：要么模糊到无法指导执行，要么过度细化而在第一次环境变化后就失真。本技能让计划在证据支撑之前保持粗粒度，然后依据观察到的现实持续修订。

控制回路：

```text
目标 -> 约束/假设 -> L0/L1/L2 计划 -> 执行 -> 观察证据
     -> 修订 -> 选择 CONTINUE / PAUSE / SCOPE-DOWN / PIVOT / STOP
```

## 核心特性

- PLAN 与 EXECUTE 双模式，划清规划与副作用的边界。
- 渐进展开：L0 架构、L1 里程碑、L2 可执行焦点。
- 目标、指标、事实、假设、决策、风险、依赖与证据账本。
- 受保护资产处置：源码、用户数据、配置、秘密、运行态与生成物。
- 最小变更协议：`READ -> CLASSIFY -> PROTECT -> CHANGE -> VERIFY -> RECONCILE -> ROLLBACK/RECORD`。
- E0-E4 证据分级，从模型推断到真实用户结果。
- 失败重规划、停滞断路器、回滚纪律与真实状态对账。
- 面向高影响或不可逆变更的对抗式评审（可选）。
- 支持 Git 与非 Git 两种项目状态恢复方式。
- 面向公开文档与技能发布的收尾验证检查。
- 运行期纪律规则：外部依赖健康、静默失败类别、自动化护栏、幂等批处理与降级阶梯。

## 安装

### npm 方式（GitHub 源，无需注册账号）

```bash
npm i -g github:240xu/tech-lead-skill
tech-lead-skill          # 安装到 ~/.config/opencode/skills/tech-lead
```

一次性运行（不全局安装）：

```bash
npx github:240xu/tech-lead-skill
```

安装器幂等，重复执行会先把旧文件备份为 `*.bak-<时间戳>`；`--target <目录>` 可自定义目标；`--check` 校验已装副本与包的哈希/版本漂移；`--dry-run` 预览不写入；`--uninstall` 卸载时只删除清单受管文件，用户文件与 `*.bak-*` 备份全部保留。

`--check` 退出码：`0` 正常，`1` 检出漂移，`2` 用法/拒绝错误。

### DeepSeek Harness 插件（只读工具）

本源码仓库提供可选 DSH bundle，暴露 21 个只读生命周期工具。原有九个审计工具保持兼容，并新增上下文校验、证据图与新鲜度分析、推进决策、关键路径与影响分析、续跑对账、Gate 计划/聚合/重开检查，以及变更预览。工具仅对调用方传入的 JSON 做计算——无文件写入、无子进程、无网络访问。根 npm 包只发布技能与安装器；DSH workspace bundle 尚未独立发布，安装前请先 clone 本仓库。

```bash
dsh plugin --profile headless add /path/to/tech-lead-skill/packages/dsh-tech-lead-bundle
dsh --profile headless --dump-config   # 确认 tech-lead-tools 行已注入
```


输出家族与限制：

- 十二个强化工具返回 `tech-lead.result.v1` 信封（判别字段：`meta.schema`）；原有九个工具为向后兼容保留裸领域形状。
- 渲染输出有上限：finding/error 数组每字段最多 500 条并附 `FINDINGS_TRUNCATED` 警告；超限调用方回显数组折叠为 `{truncated,total}` 摘要；超过 256KB 自动切换紧凑序列化。

架构与权限矩阵见 [spec](https://github.com/240xu/tech-lead-skill/blob/main/docs/superpowers/specs/2026-08-25-dsh-tech-lead-system.md)。

### 手动方式

将 `skill/SKILL.md` 和 `skill/templates/` 目录复制到你所用 OpenCode 兼容环境的技能目录：

```text
~/.config/opencode/skills/tech-lead/
```

该技能由"构建项目/搭系统/制定执行计划/部署/迁移/发布/恢复/重构/运维"等实质性任务触发，即使用户没有明确说“项目”或“Tech Lead”也应加载；也可以显式加载。

## 工作模式

### PLAN

用于需求接入、目标定义、架构设计、任务分解、风险分析与验证设计。PLAN 不改文件、不执行有副作用的命令。

### EXECUTE

在 L2 范围明确后使用。只执行最小已批准变更，记录改动，验证行为，对账实际状态，并更新计划。

## 受保护资产

| 类别 | 默认处置 |
|---|---|
| `SOURCE` | 可审查 diff、测试与恢复点 |
| `USER_DATA` | 默认只读；仅在目标明确且有可恢复副本时写入 |
| `CONFIG` | 先读现状，最小修改，重载后验证 |
| `SECRET` | 绝不进入计划、日志、普通备份或 diff |
| `RUNTIME` | 重启/杀进程/替换/迁移前必须先查实时状态 |
| `GENERATED` | 优先重新生成；不作为事实源 |

## 证据分级

- `E0`：模型推断；仅可用于提出假设。
- `E1`：静态阅读、grep 或配置检查。
- `E2`：本地命令或单元测试；仅证明局部行为。
- `E3`：集成测试、真实进程或真实端点。
- `E4`：用户验收、真实业务结果或生产观察。

## 模板

- `templates/intake.md`：目标、约束、资产、风险与完成层级。
- `templates/plan.md`：L0/L1/L2 计划与当前焦点。
- `templates/change-record.md`：单次 EXECUTE 变更及其对账。
- `templates/round.md`：单轮规划迭代及其结果。
- `templates/state.json`：可续跑的规范状态投影。
- `templates/gate-review.md` 与 `templates/gate-verdict.md`：独立评审与裁决记录。
- `templates/release-check.md`：发布清单、扫描、远程验证与限制记录。

## 范围

这是一套工程规划技能，聚焦规划正确性、用户文件与代码改动的安全处置、证据质量、回滚以及真实环境对账。它有意不涉及组织级流程设计或通用项目管理方法论。

## 局限

- 文本判断层有意保持非机械化；只有源码安装的 DSH bundle 才提供上下文、证据、推进、Gate、发布/安装审计、恢复与变更预览的可机检只读运行时。
- 在纯文本技能形态下（无 bundle），证据时效与状态对账仍依赖执行环境与操作者。
- 本技能不提供沙箱；除非已有真实隔离执行环境，否则不得运行不可信代码。
- MCP 工具化候选应在观察到真实项目中反复违例之后再筛选。

## 说明

可执行的技能正文 `SKILL.md` 以简体中文编写；编码代理无论对话语言为何均可正确执行。模板为面向代理的英文文件。文档翻译覆盖本 README 与技术指南。

## 版本

当前版本：`v5.4.4`。

完整运行模型见[技术指南](./docs/TECHNICAL_GUIDE.zh-CN.md)，发布审计见 [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md)。
