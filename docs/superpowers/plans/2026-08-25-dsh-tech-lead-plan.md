# Tech Lead 系统化实施计划

> **执行者须知**：按任务顺序执行，每步先跑验证命令再勾选。规格见
> `docs/superpowers/specs/2026-08-25-dsh-tech-lead-system.md`（接口契约以规格 §4 为准）。

**Goal:** 修复 Skill 安装器缺陷并交付 DSH 只读工具链（core/plugin/bundle），最终装入 headless+web。

**Architecture:** 同仓库 pnpm workspace；core 纯函数零依赖；plugin 经 defineTool 注册只读工具；
bundle 一行 patch 引用 plugin。全部离线测试先行，profile 实装最后做且逐个验证。

**Tech Stack:** Node ≥16（CJS installer + ESM packages）、pnpm workspace、node:test、vendored cordis Loader 组合测试。

## Global Constraints

- 第一阶段工具零副作用：无 fs 写、无 child_process、无网络、无 secret 读取。
- installer 保持 CJS `'use strict'`，engines 提升为 `>=16`。
- profile 配置改动前必须备份 `.bak-techlead-<ts>`。
- 每个 Phase 结束打一个 commit；测试不过不进下一 Phase。
- 对外文档改动仅 English + 简体中文双语。

---

### Task A1: 重写 bin/install.js（manifest 精确 + 安全卸载 + --check/--dry-run）

**Files:**
- Modify: `bin/install.js`（整体重写）
- Modify: `package.json`：engines `>=16`
- Test: `tests/installer.test.js`

**Interfaces（Produces）:**
- CLI：`(no args)` 安装 | `--target <dir>` | `--uninstall` | `--check` | `--dry-run` | `--version` | `--help`
- marker `.tech-lead-skill.json`：`{package,version,installedAt,files:string[]}`，
  files=skill/ 递归全部相对路径（SKILL.md、templates/*.md、templates/state.json）
- uninstall 仅删除 marker.files+marker；保留 .bak-* 与外来文件；空目录自底向上尝试 rmdir；
  报告 leftover。marker 不存在 → exit 2 拒绝。
- --check 退出码：0 一致 / 1 漂移 / 2 用法错；报告 missingManaged/unmanaged/hashDrift/versionMismatch。
- --dry-run 打印将执行动作，零写入。

**Steps:**
- [x] Step1 写失败测试 `tests/installer.test.js`（node:test）：临时目录安装→断言文件全集含 state.json 与 marker.files 精确匹配；重装产生 .bak；写入外来文件后 uninstall→外来文件仍在且目标仅剩空骨架/被清空的受管集；--check 在删掉一个受管文件后 exit 1；--dry-run 后目录无变化。
- [x] Step2 `node --test tests/installer.test.js` → 预期 FAIL（旧实现缺 state.json、递归删除）。
- [x] Step3 重写 install.js 实现上述契约（walk 函数收集相对路径；copyWithBackup 复用；uninstall 逐文件 unlink）。
- [x] Step4 测试全绿；`node tests/installer.test.js` exit 0。
- [x] Step5 commit `fix(installer): managed-file manifest, safe uninstall, check/dry-run (v5.4)`

### Task A2: state.json 校验器（core 先行单件）+ Skill 文档条款

**Files:**
- Create: `packages/dsh-tech-lead-core/src/state.js`（validateState 单函数先行）
- Create: `packages/dsh-tech-lead-core/package.json`（name @240xu/dsh-tech-lead-core, type module, exports ./src/index.js 占位）
- Create: `tests/state.test.js`
- Modify: `skill/templates/state.json`：schema_version 改数字 `1`，占位串改真实默认值（repository_mode:"git", updated_at:""）
- Modify: `skill/SKILL.md` §7 追加「state.json 可机检」一段（中英对照由既有文档结构决定）

**Interfaces:**
- `validateState(raw:any) -> {valid:boolean, errors:[{path,message}], warnings:[{path,message}], unknownFields:string[]}`（规格 §4.1 全规则）
- [x] Step1 state.test.js：合法 fixture 过；mode/tier/last_outcome 越界报错；done 缺 anchor 报错；evidence 缺 repro 报错且 level=E9 越界报错；unknown 字段→warning+记录不判 invalid；schema_version "1" 字符串兼容通过。
- [x] Step2 红→绿循环实现 state.js。
- [x] Step3 更新模板与 SKILL.md 条款；`git diff --check` 干净。
- [x] Step4 commit `feat(core): machine-checkable state schema v1 validator`

### Task B1: workspace 化 + core 其余纯函数

**Files:**
- Create: `pnpm-workspace.yaml`（packages/*）
- Create: `packages/dsh-tech-lead-core/src/{classify,evidence,plan,gate,release,install,resume,index}.js`
- Create: `packages/dsh-tech-lead-core/tests/*.test.js`（每模块一文件）
- Root `package.json` 增加 `"workspaces":["packages/*"]`（保持根仍可 npm publish 自身）

**Interfaces:** 规格 §4.1 全签名（classify/evidenceLint/planLint/gatePrecheck/releaseAudit/installAudit/resumeCard）。

**Steps:**
- [x] Step1 每模块先写失败测试（≥3 例：正常/违例/边界）再实现，红绿循环。
- [x] Step2 `cd packages/dsh-tech-lead-core && node --test tests/` 全绿。
- [x] Step3 根回归：`node --test tests/`（A1+A2）仍绿。
- [x] Step4 commit `feat(core): pure validators for classify/evidence/plan/gate/release/install/resume`

### Task C1: dsh-tech-lead-plugin

**Files:**
- Create: `packages/dsh-tech-lead-plugin/{package.json,src/index.js,src/tools/*.js,test/composition/{cordis.yml,driver.ts}}`
- Deps: `@240xu/dsh-tech-lead-core`（workspace）、`@deepseek-ai/dsh-tools`（registry 或 file: 兜底，见规格 §7）

**Interfaces:** 规格 §4.2 工具表 9 项；named exports name/inject/apply。

**Steps:**
- [x] Step1 探测 registry：`npm view @deepseek-ai/dsh-tools version` → 决定 dep 形态。
- [x] Step2 实现 index.js：9 个 defineTool 包装 core；入参 schema 与 render 全部落码。
- [x] Step3 组合测试：cordis.yml = system-prompt + tools + plugin + driver.ts；driver 经
      `ctx.tools.execute` 依次调用 9 工具并断言关键字段；运行命令：
      `cd test/composition && node --import tsx <harness>/vendor/cordis/bin.js`
      （已被 `npm run test:composition` 取代；本节为历史记录）
      断言 stdout 含 `TLT-PASS 9/9` 且进程 exit 0。
- [x] Step4 commit `feat(plugin): register nine read-only tech-lead tools`

### Task D1: bundle + techtest profile

**Files:**
- Create: `packages/dsh-tech-lead-bundle/{package.json,cordis.patch.yml,README.md}`
- Runtime: `~/.dsh/profiles/techtest/`（隔离 profile，可整目录删除）

**Steps:**
- [x] Step1 bundle 包：patch 内容见规格 §4.3；package.json 带 dsh.bundle.patch + plugin 依赖。
- [x] Step2 `dsh plugin --profile techtest add <abs path to repo>/packages/dsh-tech-lead-bundle`
      （CLI 自动 init profile+bundles+pnpm）。
- [x] Step3 加载验证：headless 一次性任务或最小 cordis 启动确认 tech-lead 工具注册日志出现；
      失败则回滚 profile（还原 .bak）并修 patch 形状。
- [x] Step4 commit `feat(bundle): opt-in dsh bundle exposing read-only tech-lead tools`

### Task D2: headless → web 实装（每步独立复核）

- [x] Step1 备份两 profile 的 package.json+cordis.patch.yml → `.bak-techlead-<ts>`。
- [x] Step2 headless add bundle → 启动加载验证 → 通过才继续。
- [x] Step3 web add bundle → 启动加载验证。
- [x] Step4 任一步失败：还原该 profile 备份，问题修复后重走该步。
- [x] Step5 commit（如有 repo 内产物变更）+ 记录安装结果到本计划勾选框。

### Task E1: 收尾

- [x] Step1 版本：root 5.4.0；三个新包各自 0.1.0；README 双语补「DSH 插件」章节。
- [x] Step2 全量回归：installer+state+core+composition 四套全绿。
- [x] Step3 发布审计：releaseAudit 白名单扫描（本地路径/token 正则）；`npm pack --dry-run` 清单核对。
- [ ] Step4 push 前向用户报告结果，等明确指令再推送/发布（推送属对外动作）。
