# VisualStoryEditor 原型开发验收清单

本文档配合 `docs/rpg-story-generator-design.md` 使用，目标是让 Vue3 + TypeScript + Pinia 原型能够被开发、测试和验收。当前工程已包含 Vite、Vue3、TypeScript、Pinia 和 Vitest，测试用例已落在 `tests/` 目录，可通过 `npm test` 执行。
npm --version
10.9.2
node --version
v22.15.0
## 1. 工程初始化建议

- 使用 Vite 初始化 Vue3 + TypeScript 工程。
- 引入 Pinia 作为全局状态管理。
- 引入 Vitest 作为单元测试框架。
- 推荐引入 Zod 做导入文件、AI 输出和运行时数据校验。
- 推荐使用 Vue Flow 作为第一版节点画布，降低画布交互开发成本。
- `src/domain`、`src/runtime`、`src/io`、`src/ai` 应保持纯 TypeScript，避免直接依赖 Vue 组件。

建议脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

## 2. 模块契约测试清单

### 2.1 Domain Evaluator

目标 API：

- `src/domain/expression/evaluator.ts`
- `evaluateCondition(condition, runtimeContext): boolean`

验收点：

- 支持 `player.attributes.hp >= 80`。
- 支持 `global.variables.fogLevel < 3`。
- 支持 `player.flags.hasMap == true`。
- 支持 `hasItem("item_id")`、`itemCount("item_id")`、`relation("npc_id")`。
- 拒绝 `globalThis`、`fetch`、`localStorage`、未知函数等不安全表达式。
- 不允许直接使用浏览器 `eval` 执行用户输入。

对应测试草稿：

- `tests/domain/evaluator.spec.ts`

### 2.2 Effect Apply / Rollback

目标 API：

- `src/domain/effects/applyEffect.ts`
- `applyEffect(ctx, effect): StateDiff`
- `src/domain/effects/rollbackEffect.ts`
- `rollbackDiffs(ctx, diffs): void`

验收点：

- 支持 `set`、`inc`、`dec`、`append`、`remove`、`toggle`。
- 玩家属性变更能写入 `actorsById[playerId]`。
- NPC 关系变更能写入指定 NPC。
- 全局 flag 变更能写入 `state.global.flags`。
- 每次 effect 必须返回 `before`、`after`、`path`。
- `rollbackDiffs` 可按 diff 回滚。

对应测试草稿：

- `tests/domain/effects.spec.ts`

### 2.3 Graph Resolver

目标 API：

- `src/runtime/graphResolver.ts`
- `resolveNextNodeId(graph, fromNodeId, outputPort, ctx): ID | null`
- `validateGraph(graph): { valid: boolean; errors: string[]; warnings: string[] }`

验收点：

- 根据节点 ID 和输出端口找到下一节点。
- edge guard 为 false 时跳过连线。
- 无有效连线时返回 `null`。
- 校验 from/to 节点存在。
- 校验 from/to port 存在于节点端口定义。
- 不可达节点作为 warning，非法连线作为 error。

对应测试草稿：

- `tests/runtime/graphResolver.spec.ts`

### 2.4 Project IO

目标 API：

- `src/io/exportProject.ts`
- `exportProjectJson(project): string`
- `src/io/importProject.ts`
- `importProjectJson(json): GameProject`

验收点：

- `.rpgstory.json` 可导出并重新导入。
- 导入时校验 JSON 语法。
- 导入时校验 `schemaVersion`。
- 导入时校验 `playerId`、actor、item、location、faction、edge 引用。
- 导入不应直接写入 Pinia，应先返回已校验项目对象。
- 错误信息应包含可定位字段或 ID。

对应测试草稿：

- `tests/io/projectIo.spec.ts`

### 2.5 Markdown Export

目标 API：

- `src/io/exportMarkdown.ts`
- `exportMarkdown(project, options): string`

验收点：

- 导出标题、世界背景、角色、物品、剧情节点、流向、状态变更索引。
- 每个节点标题包含节点 ID，便于从 Markdown 回查节点图。
- 遇到环路不无限展开。
- 可通过 options 控制是否包含 AI notes 和 JSON blocks。
- 默认导出文件名建议为 `mark.md`。

对应测试草稿：

- `tests/io/exportMarkdown.spec.ts`

### 2.6 AI Parse / Draft

目标 API：

- `src/ai/schemas.ts`
- `validateGenerateBranchesOutput(value, existingIds): string[]`

验收点：

- AI 生成内容必须先进入草稿，不直接修改 project。
- 校验新增节点 ID 不与既有 ID 冲突。
- 校验 edge 引用节点和端口存在。
- 校验 guard expression 只使用允许 DSL。
- 对非法输出保留 draft 和 validationErrors，供用户查看和修复。

对应测试草稿：

- `tests/ai/schemas.spec.ts`

## 3. 手动验收路径

### 3.1 最小剧情闭环

步骤：

1. 新建项目。
2. 创建世界观、1 个玩家、1 个 NPC、1 个任务物品。
3. 在画布创建 `start -> story -> choice -> end`。
4. 为 choice 添加两个选项。
5. 为至少一个选项添加 `global.flags.met_elena set true`。
6. 点击运行预览。
7. 选择该选项。

通过标准：

- 当前节点从 start 自动进入 story。
- 用户选择后进入正确 end 节点。
- 运行时状态显示 `met_elena = true`。
- 执行日志包含节点、选项、effect diff。

### 3.2 条件分支验收

步骤：

1. 添加 condition 节点。
2. 配置条件 `player.attributes.hp > 30`。
3. 配置 true 和 fallback 两条输出。
4. 在运行预览中调整玩家 hp。
5. 分别执行两次。

通过标准：

- hp 大于 30 时走 true 分支。
- hp 小于等于 30 时走 fallback 分支。
- 条件判断结果写入运行日志。

### 3.3 随机分支验收

步骤：

1. 添加 random 节点。
2. 配置两个输出，权重分别为 70 和 30。
3. 设置固定 `seedKey`。
4. 多次重启运行。

通过标准：

- 同一 seed 下结果可复现。
- 不同 seed 下结果允许变化。
- 权重为 0 或负数时编辑器提示错误。

### 3.4 导入导出验收

步骤：

1. 创建包含 story、choice、mutation、condition、end 的项目。
2. 导出 `.rpgstory.json`。
3. 刷新页面或新建空项目。
4. 重新导入该 JSON。

通过标准：

- 节点数量、连线数量、角色、物品、状态保持一致。
- 画布位置保持一致。
- 非法 JSON 能显示友好错误。
- 缺失引用能显示具体 ID。

### 3.5 Markdown 验收

步骤：

1. 使用同一项目导出 `mark.md`。
2. 打开 Markdown 预览。
3. 检查世界观、角色、物品、剧情节点、选项、状态变更索引。

通过标准：

- 策划人员不看 JSON 也能理解剧情流程。
- 每个剧情段落都能通过节点 ID 回查画布。
- 环路不会造成重复刷屏。

### 3.6 AI 生成验收

步骤：

1. 配置 OpenAI 兼容 `baseUrl`、`model`、`apiKey`。
2. 输入题材和风格，生成世界观。
3. 基于世界观生成角色。
4. 选中一个剧情节点，生成三条后续分支。
5. 查看 AI draft。
6. 采纳其中一个 draft。

通过标准：

- AI 请求使用 Chat Completions 兼容接口。
- 成功输出结构化 JSON。
- 输出先进入 draft，不直接写入主项目。
- 采纳后新增节点和连线。
- 非法输出显示 validationErrors。

## 4. 原型完成定义

第一版原型达到以下条件即可进入内部试用：

- Vue3 + TypeScript + Pinia 工程可启动。
- 可创建和编辑玩家、NPC、物品、全局状态。
- 可创建 start、story、choice、mutation、condition、random、end 节点。
- 可连线并保存节点位置。
- 可从 start 运行并根据选项、条件、随机结果跳转。
- choice 和 mutation effects 能改变玩家、NPC、全局状态。
- 可导出并导入 `.rpgstory.json`。
- 可导出 `mark.md`。
- AI 分支生成可返回可校验 draft。
- `tests/` 中的契约测试通过或被实现等价测试替代。

## 5. 后续工程化建议

- 增加 `vitest --coverage`，核心 domain/runtime/io 覆盖率建议先达到 80%。
- 增加 Playwright，用于节点画布、属性面板、运行预览的端到端测试。
- 增加导入文件 fixture 库，覆盖合法项目、缺失引用、循环图、旧版本迁移。
- 给 `.rpgstory.json` 添加 JSON Schema，方便编辑器和外部工具校验。
- 给 AI draft 添加快照测试，防止 schema 漂移。
- 为 effect 系统增加属性边界校验，例如 hp 不低于 0、不高于 max。
- 为 graph resolver 增加多 edge 同端口策略说明，例如按顺序匹配 guard。
- 将 API Key 存储限制为 session 级，正式产品通过后端代理调用模型。
- 增加自动保存、撤销重做、节点复制粘贴和执行日志导出。

## 6. 当前待主智能体整合点

- `tests/fixtures/sampleProject.ts` 依赖当前 `src/domain/types/project` 的类型导出，后续改动类型时需同步 fixture。
- 当前测试覆盖 `evaluateCondition`、`applyEffect`、`rollbackDiffs`、`resolveNextNodeId`、`validateProjectBasic`、`exportProjectJson`、`importProjectJson`、`exportMarkdown`、`validateGenerateBranchesOutput`。
- AI 草稿的采纳、丢弃、局部合并仍需在 Pinia 或 service 层补充集成测试。
- 画布交互、属性面板和运行预览建议后续补 Playwright 端到端测试。
