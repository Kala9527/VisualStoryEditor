# RPG 剧情生成器产品与技术方案

## 0. 覆盖要求检查

本文档用于指导 Vue3 + TypeScript + Pinia RPG 游戏剧情生成器原型开发，已覆盖以下内容：

- 基于 Vue3 + TypeScript + Pinia 的前端产品与工程架构。
- 玩家、NPC、全局状态、属性、物品、剧情节点、选项、条件判断、随机分支、属性变更等核心模型。
- 可视化工作流节点与连线协议。
- 剧情执行、状态变更、条件判断、分支选择的运行流程。
- 适合程序解析、AI 理解的导入/导出文件格式。
- `mark.md` 可读 Markdown 导出结构。
- OpenAI 兼容 Chat Completions API 接入方式、提示词策略与结构化输出校验。
- 可拆分的开发优先级和原型实现步骤。

## 1. 产品定位与核心功能

### 1.1 产品定位

RPG 剧情生成器是一个面向游戏策划、叙事设计师和独立开发者的节点式剧情编辑工具。

它的核心目标是让用户在一个统一工作台中完成：

- 世界观设定。
- 玩家、角色、NPC、敌人、阵营和物品配置。
- 剧情节点、选择项、条件分支、随机事件、战斗结果、状态变更编排。
- 剧情工作流导入、导出、版本管理。
- 可读 Markdown 文档导出。
- 通过 OpenAI 兼容接口生成世界观、角色属性和后续剧情分支。

### 1.2 核心用户

- RPG 游戏策划：关注剧情结构、分支条件和状态变更。
- 编剧与叙事设计师：关注世界观、角色关系、对白和分支叙事。
- 前端或游戏原型开发者：关注数据协议、运行时解释器和导出格式。
- AI 工作流设计者：关注如何把现有剧情上下文交给模型，并获得可验证的结构化结果。

### 1.3 核心功能

| 功能 | 说明 |
| --- | --- |
| 世界观管理 | 设置故事背景、地点、阵营、叙事风格、主线冲突 |
| 角色管理 | 定义玩家、队友、NPC、敌人、关系、属性、背包、状态 |
| 物品管理 | 定义武器、防具、消耗品、任务物品、材料和特殊效果 |
| 节点式编辑 | 通过画布添加剧情、选项、条件、随机、属性变更、战斗和结束节点 |
| 连线编排 | 使用输入/输出端口表达剧情流向 |
| 运行预览 | 从起始节点执行剧情，选择分支，观察状态变化 |
| 条件判断 | 根据玩家、NPC、全局状态、物品、flag 决定剧情走向 |
| 状态变更 | 选项或节点可修改全局状态、玩家属性、NPC 好感、背包等 |
| 导入导出 | 使用 `.rpgstory.json` 保存完整项目 |
| Markdown 导出 | 生成策划可读的 `mark.md` |
| AI 生成 | 生成世界观、角色、属性、剧情节点和后续分支 |

## 2. 技术栈与模块架构

### 2.1 技术栈

| 分类 | 推荐方案 |
| --- | --- |
| 前端框架 | Vue3 |
| 语言 | TypeScript |
| 构建工具 | Vite |
| 状态管理 | Pinia |
| 节点画布 | Vue Flow 或基于 SVG/Canvas 的自研节点图 |
| 数据校验 | Zod |
| 表达式解析 | 自研受限 DSL 或 jsep + 白名单解释器 |
| Markdown | markdown-it 或 marked |
| 本地持久化 | IndexedDB / localForage |
| AI 接入 | OpenAI 兼容 Chat Completions API |

### 2.2 前端目录建议

```text
src/
  app/
    App.vue
    router.ts
  components/
    common/
    editor/
      NodeCanvas.vue
      InspectorPanel.vue
      NodePalette.vue
      RuntimePreview.vue
    nodes/
      StoryNode.vue
      ChoiceNode.vue
      ConditionNode.vue
      RandomNode.vue
      MutationNode.vue
      CombatNode.vue
  domain/
    types/
      project.ts
      actor.ts
      item.ts
      workflow.ts
      runtime.ts
    expression/
      parser.ts
      evaluator.ts
      helpers.ts
    effects/
      applyEffect.ts
      rollbackEffect.ts
      diffState.ts
  runtime/
    executor.ts
    graphResolver.ts
    random.ts
  stores/
    projectStore.ts
    workflowStore.ts
    runtimeStore.ts
    aiStore.ts
    settingsStore.ts
  io/
    importProject.ts
    exportProject.ts
    exportMarkdown.ts
    migrations/
      v1.ts
  ai/
    provider.ts
    schemas.ts
    prompts.ts
    storyGenerator.ts
  tests/
```

### 2.3 模块边界

- `domain/`：纯类型、规则、表达式、效果系统，不依赖 Vue。
- `runtime/`：剧情图解释器，不关心画布 UI。
- `stores/`：连接 UI 和 domain/runtime。
- `io/`：文件导入导出、版本迁移、Markdown 生成。
- `ai/`：AI API 调用、结构化 schema、提示词模板、输出校验。
- `components/`：只处理交互和展示，复杂业务逻辑下沉到 domain/runtime。

## 3. 核心数据模型 TypeScript 示例

### 3.1 通用类型

```ts
export type ID = string;

export type AttributeValue = number | string | boolean;

export type AttributeType = "number" | "string" | "boolean" | "enum";

export interface AttributeDef {
  key: string;
  label: string;
  type: AttributeType;
  description?: string;
  min?: number;
  max?: number;
  enumValues?: string[];
  defaultValue?: AttributeValue;
}

export type EntityScope = "global" | "player" | "npc";
```

### 3.2 世界观与地点

```ts
export interface LocationDef {
  id: ID;
  name: string;
  summary: string;
  tags?: string[];
  parentLocationId?: ID;
}

export interface FactionDef {
  id: ID;
  name: string;
  summary: string;
  alignment?: string;
  relations?: Record<ID, number>;
}

export interface WorldDef {
  premise: string;
  tone: string;
  genre?: string;
  themes?: string[];
  locations: LocationDef[];
  factions: FactionDef[];
  loreEntries?: Array<{
    id: ID;
    title: string;
    content: string;
  }>;
}
```

### 3.3 物品模型

```ts
export type ItemType =
  | "weapon"
  | "armor"
  | "consumable"
  | "quest"
  | "material"
  | "misc";

export interface Item {
  id: ID;
  name: string;
  type: ItemType;
  description?: string;
  stackable?: boolean;
  maxStack?: number;
  attributes?: Record<string, AttributeValue>;
  tags?: string[];
}

export interface InventoryEntry {
  itemId: ID;
  count: number;
  equipped?: boolean;
}
```

### 3.4 玩家、NPC、敌人和角色模型

```ts
export type ActorRole = "player" | "companion" | "npc" | "enemy";

export interface Actor {
  id: ID;
  name: string;
  role: ActorRole;
  summary: string;
  biography?: string;
  factionId?: ID;
  locationId?: ID;
  attributes: Record<string, AttributeValue>;
  inventory: InventoryEntry[];
  flags: Record<string, boolean>;
  relations?: Record<ID, number>;
  tags?: string[];
  aiNotes?: string;
}
```

属性建议：

```ts
export const defaultAttributeDefs: AttributeDef[] = [
  { key: "hp", label: "生命", type: "number", min: 0, max: 100, defaultValue: 100 },
  { key: "mp", label: "魔力", type: "number", min: 0, max: 100, defaultValue: 30 },
  { key: "strength", label: "力量", type: "number", min: 0, max: 20, defaultValue: 5 },
  { key: "intelligence", label: "智力", type: "number", min: 0, max: 20, defaultValue: 5 },
  { key: "charisma", label: "魅力", type: "number", min: 0, max: 20, defaultValue: 5 },
  { key: "courage", label: "勇气", type: "number", min: 0, max: 20, defaultValue: 5 },
  { key: "morality", label: "道德", type: "number", min: -100, max: 100, defaultValue: 0 }
];
```

### 3.5 全局状态

```ts
export interface WorldState {
  variables: Record<string, AttributeValue>;
  flags: Record<string, boolean>;
  discoveredLocations: ID[];
  completedQuests?: ID[];
}

export interface ProjectState {
  playerId: ID;
  global: WorldState;
}
```

### 3.6 条件与状态变更

```ts
export interface Condition {
  id: ID;
  label?: string;
  expression: string;
}

export interface EffectTarget {
  scope: EntityScope;
  actorId?: ID;
  path: string;
}

export type EffectOperation =
  | "set"
  | "inc"
  | "dec"
  | "append"
  | "remove"
  | "toggle";

export interface Effect {
  id: ID;
  target: EffectTarget;
  op: EffectOperation;
  value?: AttributeValue | InventoryEntry | ID;
  reason?: string;
}
```

示例：

```ts
const loseHp: Effect = {
  id: "effect_lose_hp",
  target: { scope: "player", path: "attributes.hp" },
  op: "dec",
  value: 10,
  reason: "强行穿越浓雾受到伤害"
};

const improveRelation: Effect = {
  id: "effect_elena_relation_up",
  target: { scope: "npc", actorId: "npc_elena", path: "relations.player" },
  op: "inc",
  value: 5,
  reason: "玩家选择相信 Elena"
};
```

### 3.7 项目根模型

```ts
export interface GameProject {
  schemaVersion: "1.0";
  meta: {
    title: string;
    author?: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  };
  world: WorldDef;
  attributeDefs: AttributeDef[];
  items: Item[];
  actors: Actor[];
  state: ProjectState;
  workflow: WorkflowGraph;
}
```

## 4. 工作流节点类型设计

### 4.1 节点基类

```ts
export type NodeType =
  | "start"
  | "story"
  | "choice"
  | "condition"
  | "random"
  | "mutation"
  | "combat"
  | "end";

export interface WorkflowNodeBase {
  id: ID;
  type: NodeType;
  title: string;
  position: {
    x: number;
    y: number;
  };
  inputPorts: string[];
  outputPorts: string[];
  aiSummary?: string;
  designNotes?: string;
}
```

### 4.2 开始节点

```ts
export interface StartNode extends WorkflowNodeBase {
  type: "start";
  inputPorts: [];
  outputPorts: ["out"];
}
```

规则：

- 每个项目只有一个 start 节点。
- start 节点不能被其他节点连入。
- start 节点只能有一个默认输出。

### 4.3 剧情节点

```ts
export interface StoryNode extends WorkflowNodeBase {
  type: "story";
  content: string;
  speakerId?: ID;
  locationId?: ID;
  sceneTags?: string[];
}
```

用途：

- 展示旁白。
- 展示 NPC 对白。
- 承载剧情描述。
- 作为 AI 续写上下文的基本单元。

### 4.4 选项节点

```ts
export interface Choice {
  id: ID;
  text: string;
  visibleWhen?: Condition[];
  enabledWhen?: Condition[];
  effects?: Effect[];
  nextNodeId?: ID;
  aiIntent?: string;
}

export interface ChoiceNode extends WorkflowNodeBase {
  type: "choice";
  prompt: string;
  choices: Choice[];
}
```

规则：

- 每个选项建议对应一个输出端口：`choice:{choiceId}`。
- `visibleWhen` 控制是否展示。
- `enabledWhen` 控制是否可点击。
- 选择后先执行 `effects`，再进入对应连线。

### 4.5 条件判断节点

```ts
export interface ConditionBranch {
  port: string;
  label: string;
  condition: Condition;
}

export interface ConditionNode extends WorkflowNodeBase {
  type: "condition";
  branches: ConditionBranch[];
  fallbackPort: string;
}
```

规则：

- 按 branches 数组顺序判断。
- 命中第一个 `true` 分支。
- 全部失败则走 `fallbackPort`。
- 可用于属性门槛、物品门槛、好感门槛、任务进度判断。

### 4.6 随机节点

```ts
export interface RandomBranch {
  port: string;
  label: string;
  weight: number;
}

export interface RandomNode extends WorkflowNodeBase {
  type: "random";
  branches: RandomBranch[];
  seedKey?: string;
}
```

规则：

- `weight` 必须大于 0。
- 同一随机节点的分支权重相加后进行加权抽样。
- `seedKey` 用于可复现随机，例如每日事件、固定存档回放。

### 4.7 属性变更节点

```ts
export interface MutationNode extends WorkflowNodeBase {
  type: "mutation";
  effects: Effect[];
}
```

规则：

- 进入节点后立即执行所有 effects。
- effects 应生成状态 diff，支持回放和撤销。
- 执行完成后走 `out`。

### 4.8 战斗节点

```ts
export interface CombatEnemy {
  actorId: ID;
  level?: number;
}

export interface CombatNode extends WorkflowNodeBase {
  type: "combat";
  enemies: CombatEnemy[];
  escapeAllowed: boolean;
  winEffects?: Effect[];
  loseEffects?: Effect[];
  escapeEffects?: Effect[];
}
```

建议输出端口：

- `win`
- `lose`
- `escape`
- `dead`

### 4.9 结束节点

```ts
export interface EndNode extends WorkflowNodeBase {
  type: "end";
  endingId: string;
  endingTitle: string;
  endingSummary: string;
}
```

### 4.10 节点联合类型与连线

```ts
export type WorkflowNode =
  | StartNode
  | StoryNode
  | ChoiceNode
  | ConditionNode
  | RandomNode
  | MutationNode
  | CombatNode
  | EndNode;

export interface WorkflowEdge {
  id: ID;
  from: {
    nodeId: ID;
    port: string;
  };
  to: {
    nodeId: ID;
    port: string;
  };
  label?: string;
  guard?: Condition;
}

export interface WorkflowGraph {
  startNodeId: ID;
  nodes: Record<ID, WorkflowNode>;
  edges: WorkflowEdge[];
}
```

## 5. 剧情执行与分支判断流程

### 5.1 运行时上下文

```ts
export interface RuntimeContext {
  project: GameProject;
  currentNodeId: ID;
  state: ProjectState;
  actorsById: Record<ID, Actor>;
  itemsById: Record<ID, Item>;
  history: RuntimeLog[];
}

export interface StateDiff {
  path: string;
  before: unknown;
  after: unknown;
}

export interface RuntimeLog {
  id: ID;
  nodeId: ID;
  nodeType: NodeType;
  selectedChoiceId?: ID;
  conditionResult?: {
    expression: string;
    result: boolean;
  };
  randomResult?: {
    port: string;
    seed?: string;
  };
  diffs: StateDiff[];
  nextNodeId?: ID;
  createdAt: string;
}
```

### 5.2 执行总流程

```text
start
  -> load current node
  -> execute node behavior
  -> apply effects if needed
  -> choose output port
  -> find valid edge
  -> evaluate edge guard if exists
  -> write runtime log
  -> jump to next node
  -> repeat until end
```

### 5.3 各节点执行规则

| 节点 | 执行行为 |
| --- | --- |
| start | 自动走 `out` |
| story | 展示文本，用户点击继续后走 `out` |
| choice | 计算可见/可用选项，用户选择后执行选项 effects，再走对应端口 |
| condition | 按顺序判断 branches，命中第一个 true，否则走 fallback |
| random | 按权重选择一个输出端口 |
| mutation | 执行 effects，完成后走 `out` |
| combat | 调用战斗结算，按 win/lose/escape/dead 输出 |
| end | 记录结局，停止执行 |

### 5.4 条件表达式 DSL

不建议在浏览器中直接使用 `eval`。建议提供受限表达式 DSL。

支持变量：

```text
player.attributes.hp
player.flags.hasMap
npc.npc_elena.attributes.trust
npc.npc_elena.relations.player
global.variables.fogLevel
global.flags.met_elena
```

支持函数：

```text
hasItem("item_silver_key")
itemCount("item_potion") >= 2
hasFlag("met_elena")
relation("npc_elena") >= 10
attr("player", "hp") > 30
```

支持操作符：

```text
== != > >= < <= && || !
```

示例：

```text
player.attributes.hp > 30 && hasItem("item_silver_key")
relation("npc_elena") >= 10 || global.flags.saved_child == true
```

### 5.5 状态变更执行

状态变更必须满足：

- 可校验：目标路径存在或允许创建。
- 可追踪：每次 effect 生成 diff。
- 可回滚：保存 before/after。
- 可解释：记录 reason。

伪代码：

```ts
export function applyEffect(ctx: RuntimeContext, effect: Effect): StateDiff {
  const targetObject = resolveEffectTarget(ctx, effect.target);
  const before = getByPath(targetObject, effect.target.path);
  const after = calculateNextValue(before, effect);

  setByPath(targetObject, effect.target.path, after);

  return {
    path: `${effect.target.scope}.${effect.target.actorId ?? "self"}.${effect.target.path}`,
    before,
    after
  };
}
```

### 5.6 连线解析

```ts
export function resolveNextNode(
  graph: WorkflowGraph,
  fromNodeId: ID,
  outputPort: string,
  ctx: RuntimeContext
): ID | null {
  const edges = graph.edges.filter(
    edge => edge.from.nodeId === fromNodeId && edge.from.port === outputPort
  );

  for (const edge of edges) {
    if (!edge.guard || evaluateCondition(edge.guard, ctx)) {
      return edge.to.nodeId;
    }
  }

  return null;
}
```

## 6. Pinia Store 设计

### 6.1 projectStore

职责：

- 保存当前 `GameProject`。
- 加载、保存、导入、导出项目。
- 管理 dirty 状态。
- 执行全局校验。

```ts
import { defineStore } from "pinia";

export const useProjectStore = defineStore("project", {
  state: () => ({
    project: null as GameProject | null,
    dirty: false,
    validationErrors: [] as string[]
  }),
  getters: {
    actorsById: state => Object.fromEntries((state.project?.actors ?? []).map(actor => [actor.id, actor])),
    itemsById: state => Object.fromEntries((state.project?.items ?? []).map(item => [item.id, item]))
  },
  actions: {
    loadProject(project: GameProject) {
      this.project = project;
      this.dirty = false;
    },
    markDirty() {
      this.dirty = true;
    },
    validateProject() {
      // Zod schema + graph integrity check
    }
  }
});
```

### 6.2 workflowStore

职责：

- 管理画布状态。
- 选中节点/连线。
- 添加、删除、移动、连接节点。
- 节点属性编辑。

```ts
export const useWorkflowStore = defineStore("workflow", {
  state: () => ({
    selectedNodeId: null as ID | null,
    selectedEdgeId: null as ID | null,
    viewport: { x: 0, y: 0, zoom: 1 },
    clipboardNodeIds: [] as ID[]
  }),
  actions: {
    selectNode(nodeId: ID | null) {
      this.selectedNodeId = nodeId;
      this.selectedEdgeId = null;
    },
    selectEdge(edgeId: ID | null) {
      this.selectedEdgeId = edgeId;
      this.selectedNodeId = null;
    }
  }
});
```

### 6.3 runtimeStore

职责：

- 管理当前运行节点。
- 保存运行时状态快照。
- 执行 step、choice、rollback。
- 保存历史日志。

```ts
export const useRuntimeStore = defineStore("runtime", {
  state: () => ({
    running: false,
    currentNodeId: null as ID | null,
    stateSnapshot: null as ProjectState | null,
    history: [] as RuntimeLog[]
  }),
  actions: {
    start(project: GameProject) {
      this.running = true;
      this.currentNodeId = project.workflow.startNodeId;
      this.stateSnapshot = structuredClone(project.state);
      this.history = [];
    },
    step() {
      // 调用 runtime/executor.ts
    },
    choose(choiceId: ID) {
      // 执行选项并跳转
    },
    rollback(logId: ID) {
      // 根据 StateDiff 回滚
    }
  }
});
```

### 6.4 aiStore

职责：

- 保存 AI 配置。
- 触发生成任务。
- 保存生成草稿。
- 控制采纳、丢弃和合并。

```ts
export const useAiStore = defineStore("ai", {
  state: () => ({
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "",
    generating: false,
    lastError: "",
    drafts: [] as AiDraft[]
  }),
  actions: {
    async generateWorld(input: GenerateWorldInput) {},
    async generateActor(input: GenerateActorInput) {},
    async generateBranches(input: GenerateBranchesInput) {},
    acceptDraft(draftId: ID) {},
    rejectDraft(draftId: ID) {}
  }
});
```

### 6.5 settingsStore

职责：

- 编辑器设置。
- 自动保存设置。
- AI 默认参数。
- Markdown 导出偏好。

```ts
export const useSettingsStore = defineStore("settings", {
  state: () => ({
    autosaveEnabled: true,
    autosaveIntervalMs: 30000,
    markdownIncludeJsonBlocks: true,
    markdownIncludeAiNotes: true
  })
});
```

## 7. 导入/导出文件格式示例

### 7.1 主文件格式

建议使用 `.rpgstory.json` 作为主格式。

原因：

- JSON 对程序解析友好。
- 与 TypeScript 类型、Zod schema、AI JSON 输出天然匹配。
- 可加入 `aiSummary`、`designNotes` 等字段增强 AI 理解能力。
- 易于版本迁移。

### 7.2 文件命名

```text
project-name.rpgstory.json
```

### 7.3 示例文件

```json
{
  "schemaVersion": "1.0",
  "meta": {
    "title": "雾港的银钥匙",
    "author": "team",
    "description": "黑暗奇幻调查向 RPG 序章。",
    "createdAt": "2026-07-23T10:00:00+08:00",
    "updatedAt": "2026-07-23T10:00:00+08:00"
  },
  "world": {
    "premise": "海港城市被永恒浓雾覆盖，旧王朝遗物正在苏醒。",
    "tone": "黑暗奇幻、调查、低魔",
    "genre": "dark fantasy",
    "themes": ["失忆", "代价", "旧王朝"],
    "locations": [
      {
        "id": "loc_harbor",
        "name": "雾港码头",
        "summary": "被浓雾包围的破旧码头。",
        "tags": ["港口", "序章"]
      }
    ],
    "factions": [
      {
        "id": "fac_watch",
        "name": "雾港守夜人",
        "summary": "负责在夜间维持秩序的半官方组织。",
        "alignment": "neutral"
      }
    ]
  },
  "attributeDefs": [
    {
      "key": "hp",
      "label": "生命",
      "type": "number",
      "min": 0,
      "max": 100,
      "defaultValue": 100
    },
    {
      "key": "courage",
      "label": "勇气",
      "type": "number",
      "min": 0,
      "max": 20,
      "defaultValue": 5
    }
  ],
  "items": [
    {
      "id": "item_silver_key",
      "name": "银钥匙",
      "type": "quest",
      "description": "能开启旧王城地下门的钥匙残片。",
      "stackable": false,
      "tags": ["主线"]
    }
  ],
  "actors": [
    {
      "id": "player",
      "name": "主角",
      "role": "player",
      "summary": "在码头醒来的失忆佣兵。",
      "attributes": {
        "hp": 80,
        "courage": 8
      },
      "inventory": [],
      "flags": {}
    },
    {
      "id": "npc_elena",
      "name": "Elena",
      "role": "npc",
      "summary": "守夜人的年轻调查员。",
      "factionId": "fac_watch",
      "locationId": "loc_harbor",
      "attributes": {
        "hp": 60,
        "courage": 12
      },
      "inventory": [],
      "flags": {
        "met_player": false
      },
      "relations": {
        "player": 0
      }
    }
  ],
  "state": {
    "playerId": "player",
    "global": {
      "variables": {
        "fogLevel": 3
      },
      "flags": {
        "met_elena": false
      },
      "discoveredLocations": ["loc_harbor"],
      "completedQuests": []
    }
  },
  "workflow": {
    "startNodeId": "n_start",
    "nodes": {
      "n_start": {
        "id": "n_start",
        "type": "start",
        "title": "开始",
        "position": { "x": 0, "y": 0 },
        "inputPorts": [],
        "outputPorts": ["out"]
      },
      "n_story_wake": {
        "id": "n_story_wake",
        "type": "story",
        "title": "码头醒来",
        "position": { "x": 240, "y": 0 },
        "inputPorts": ["in"],
        "outputPorts": ["out"],
        "content": "你在雾港码头醒来，手里攥着半枚银钥匙。",
        "locationId": "loc_harbor",
        "sceneTags": ["序章", "醒来"],
        "aiSummary": "主角在雾港醒来，获得银钥匙线索。"
      },
      "n_choice_first": {
        "id": "n_choice_first",
        "type": "choice",
        "title": "第一个选择",
        "position": { "x": 520, "y": 0 },
        "inputPorts": ["in"],
        "outputPorts": ["choice:ask_help", "choice:hide_key"],
        "prompt": "你听见脚步声靠近。你要怎么做？",
        "choices": [
          {
            "id": "ask_help",
            "text": "向来人求助",
            "effects": [
              {
                "id": "effect_met_elena",
                "target": { "scope": "global", "path": "flags.met_elena" },
                "op": "set",
                "value": true,
                "reason": "玩家主动接触 Elena"
              },
              {
                "id": "effect_relation_elena_up",
                "target": { "scope": "npc", "actorId": "npc_elena", "path": "relations.player" },
                "op": "inc",
                "value": 5,
                "reason": "玩家选择信任 Elena"
              }
            ],
            "aiIntent": "社交与信任路线"
          },
          {
            "id": "hide_key",
            "text": "藏起银钥匙并观察",
            "effects": [
              {
                "id": "effect_courage_up",
                "target": { "scope": "player", "path": "attributes.courage" },
                "op": "inc",
                "value": 1,
                "reason": "玩家谨慎行动"
              }
            ],
            "aiIntent": "潜行与调查路线"
          }
        ]
      }
    },
    "edges": [
      {
        "id": "e_start_wake",
        "from": { "nodeId": "n_start", "port": "out" },
        "to": { "nodeId": "n_story_wake", "port": "in" }
      },
      {
        "id": "e_wake_choice",
        "from": { "nodeId": "n_story_wake", "port": "out" },
        "to": { "nodeId": "n_choice_first", "port": "in" }
      }
    ]
  }
}
```

### 7.4 导入校验

导入时必须执行：

- JSON 语法校验。
- `schemaVersion` 校验。
- Zod schema 校验。
- ID 唯一性校验。
- `playerId` 是否存在。
- actor、item、location、faction 引用是否存在。
- edge 的 from/to 节点是否存在。
- edge 的 port 是否存在于对应节点。
- start 节点是否唯一。
- 是否至少存在一个 end 节点。原型阶段可只警告。
- 从 start 出发是否存在不可达节点。原型阶段可只警告。

### 7.5 版本迁移

建议每个版本维护 migration：

```ts
export interface Migration {
  from: string;
  to: string;
  migrate(input: unknown): unknown;
}
```

导入流程：

```text
read file
  -> parse JSON
  -> detect schemaVersion
  -> run migrations until latest
  -> zod validate
  -> graph validate
  -> load into projectStore
```

## 8. Markdown 导出示例

### 8.1 导出目标

`mark.md` 面向策划、编剧、评审和 AI 上下文复用，不要求保留所有机器字段，但必须可读、可追踪、可回到节点 ID。

### 8.2 导出结构

```md
# 雾港的银钥匙

## 项目信息
- 作者：team
- 更新时间：2026-07-23T10:00:00+08:00
- 简介：黑暗奇幻调查向 RPG 序章。

## 世界背景
海港城市被永恒浓雾覆盖，旧王朝遗物正在苏醒。

## 叙事风格
黑暗奇幻、调查、低魔

## 主题
- 失忆
- 代价
- 旧王朝

## 地点
### loc_harbor 雾港码头
被浓雾包围的破旧码头。

## 阵营
### fac_watch 雾港守夜人
负责在夜间维持秩序的半官方组织。

## 角色
### player 主角
- 类型：player
- 简介：在码头醒来的失忆佣兵。
- 属性：hp=80, courage=8
- 物品：无

### npc_elena Elena
- 类型：npc
- 简介：守夜人的年轻调查员。
- 阵营：fac_watch
- 当前地点：loc_harbor
- 属性：hp=60, courage=12
- 关系：player=0

## 物品
### item_silver_key 银钥匙
- 类型：quest
- 描述：能开启旧王城地下门的钥匙残片。

## 剧情流程
### n_start 开始
- 类型：start
- 流向：out -> n_story_wake

### n_story_wake 码头醒来
- 类型：story
- 地点：loc_harbor

你在雾港码头醒来，手里攥着半枚银钥匙。

AI 摘要：主角在雾港醒来，获得银钥匙线索。

流向：
- out -> n_choice_first

### n_choice_first 第一个选择
- 类型：choice

你听见脚步声靠近。你要怎么做？

选项：
- ask_help：向来人求助
  - 意图：社交与信任路线
  - 状态变更：global.flags.met_elena set true
  - 状态变更：npc.npc_elena.relations.player inc 5
- hide_key：藏起银钥匙并观察
  - 意图：潜行与调查路线
  - 状态变更：player.attributes.courage inc 1

## 条件索引
暂无。

## 状态变更索引
- effect_met_elena：global.flags.met_elena set true
- effect_relation_elena_up：npc.npc_elena.relations.player inc 5
- effect_courage_up：player.attributes.courage inc 1
```

### 8.3 Markdown 导出规则

- 使用图遍历从 `startNodeId` 输出剧情流程。
- 遇到环路时不重复展开，改为引用节点 ID。
- 每个节点标题必须包含节点 ID，方便回查。
- 选项、条件、状态变更单独列出。
- 如果 `settings.markdownIncludeJsonBlocks` 为 true，可在节点下追加 JSON 代码块。
- 如果 `settings.markdownIncludeAiNotes` 为 true，导出 `aiSummary` 和 `designNotes`。

## 9. OpenAI 兼容 API 接入方案

### 9.1 接入目标

AI 不是直接替代策划，而是提供可校验的草稿生成能力：

- 生成世界观背景。
- 生成角色、NPC、敌人和初始属性。
- 根据当前剧情上下文生成后续分支。
- 将自然语言创意转成结构化节点。
- 根据 `mark.md` 或当前剧情摘要补全剧情。

### 9.2 Provider 配置

```ts
export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
```

默认：

```ts
const defaultConfig: AiProviderConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  temperature: 0.8
};
```

### 9.3 Chat Completions 调用

```ts
export async function chatCompletionsJson<T>(
  config: AiProviderConfig,
  messages: ChatMessage[],
  jsonSchema: object
): Promise<T> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.8,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "rpg_story_generation",
          strict: true,
          schema: jsonSchema
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI response content is empty");
  }

  return JSON.parse(content) as T;
}
```

注意：

- 浏览器直连会暴露 API Key，正式产品建议走后端代理。
- `baseUrl` 应允许用户配置，以兼容 OpenAI 兼容服务。
- 如果供应商不支持 `response_format.json_schema`，可降级为普通 JSON 输出，然后使用 Zod 校验和修复重试。

### 9.4 AI 输出草稿机制

AI 输出不应直接写入项目，应先进入 draft：

```ts
export interface AiDraft {
  id: ID;
  type: "world" | "actor" | "branch" | "node_patch";
  title: string;
  payload: unknown;
  validationErrors: string[];
  createdAt: string;
}
```

采纳流程：

```text
AI response
  -> JSON parse
  -> Zod validate
  -> graph reference validate
  -> create AiDraft
  -> user review
  -> accept draft
  -> merge into project
```

### 9.5 生成世界观提示词

System：

```text
你是资深 RPG 世界观与任务线设计师。必须输出符合 JSON Schema 的 JSON。
世界观需要适合节点式剧情系统拆分，地点、阵营、主线冲突必须清晰。
不要输出 Markdown，不要输出额外解释。
```

User：

```text
请生成一个 RPG 故事背景。

题材：黑暗奇幻调查
叙事基调：克制、悬疑、低魔
目标游玩时长：30 分钟序章
必须包含：1 个主城地点、2 个阵营、1 个核心谜团、1 个主线物品
避免：现代科技、过度喜剧化
```

输出 schema 应对应：

```ts
export interface GenerateWorldOutput {
  world: WorldDef;
  items: Item[];
  suggestedGlobalState: WorldState;
}
```

### 9.6 生成角色与属性提示词

System：

```text
你是 RPG 角色与数值系统设计师。必须输出符合 JSON Schema 的 JSON。
所有角色属性必须使用给定 attributeDefs 中存在的 key。
NPC 关系值范围为 -100 到 100。
```

User：

```text
世界观：
{worldSummary}

属性定义：
{attributeDefs}

请生成：
- 1 名玩家初始角色
- 2 名关键 NPC
- 1 名可战斗敌人

要求：
- 属性数值适合序章阶段
- 每个 NPC 有明确动机
- 至少一个 NPC 与主线物品有关
```

输出 schema：

```ts
export interface GenerateActorsOutput {
  actors: Actor[];
  relationshipNotes: string[];
}
```

### 9.7 生成后续分支提示词

System：

```text
你是节点式 RPG 剧情工作流设计器。必须输出符合 JSON Schema 的 JSON。
只能使用已有 actor、item、location、attribute key。
新增节点 ID 使用 snake_case，且不得与 existingIds 冲突。
条件表达式只能使用允许的 DSL。
状态变更必须具体、可回滚，并说明 reason。
输出应包含新增 nodes 和 edges，不要改写现有剧情。
```

User：

```text
当前项目摘要：
{projectMarkdownSummary}

当前节点：
{currentNodeJson}

当前运行状态：
{runtimeStateJson}

已有 ID：
{existingIds}

请从当前节点生成 3 条后续分支：
1. 战斗或高风险分支
2. 交涉或关系分支
3. 探索或调查分支

每个分支需要：
- 至少 1 个 story 节点
- 至少 1 个 choice 或 condition 节点
- 至少 1 个 Effect
- 明确 edges
```

输出 schema：

```ts
export interface GenerateBranchesOutput {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  summary: string;
  integrationNotes: string[];
}
```

### 9.8 上下文压缩策略

给 AI 的上下文不应直接塞完整大型项目。推荐分层：

1. 当前节点 JSON。
2. 当前运行状态快照。
3. 与当前节点相邻的前置 3 到 5 个节点摘要。
4. 角色、物品、地点索引。
5. `mark.md` 中的剧情摘要。
6. 已有 ID 列表，避免冲突。

### 9.9 校验与重试

AI 输出校验失败时：

```text
parse failed
  -> send repair prompt with original output and validation errors
  -> parse again
  -> validate again
  -> if still failed, create invalid draft for manual review
```

修复提示词：

```text
你的上一次输出未通过校验。

校验错误：
{errors}

原始输出：
{rawOutput}

请只返回修复后的 JSON，不要解释。
```

## 10. 开发优先级与原型实现步骤

### 10.1 第一阶段：数据与编辑器骨架

目标：能创建项目、添加节点、连线、编辑字段。

任务：

- 初始化 Vue3 + TypeScript + Vite。
- 引入 Pinia。
- 定义核心 TypeScript 类型。
- 定义 Zod schema。
- 搭建三栏布局：
  - 左侧节点组件库。
  - 中间节点画布。
  - 右侧属性面板。
- 实现 start/story/choice/end 节点。
- 实现节点拖拽和连线。
- 实现项目 JSON 导出。

验收：

- 可以创建一个最小剧情：start -> story -> choice -> end。
- 可以导出 `.rpgstory.json`。

### 10.2 第二阶段：运行时解释器

目标：能运行剧情并观察状态变化。

任务：

- 实现 `runtime/executor.ts`。
- 实现 choice 选择逻辑。
- 实现 effect apply。
- 实现 runtime history。
- 实现 state diff 展示。
- 实现 story preview。

验收：

- 点击运行后从 start 开始。
- 选择选项后能够跳转到正确节点。
- 选项 effects 能改变玩家/NPC/全局状态。
- 状态变化可在预览面板看到。

### 10.3 第三阶段：条件、随机、战斗

目标：覆盖 RPG 分支核心逻辑。

任务：

- 实现条件表达式 DSL。
- 实现 condition 节点。
- 实现 random 节点。
- 实现 mutation 节点。
- 实现 combat 节点最小模型。
- 实现 edge guard。

验收：

- 可根据 `player.attributes.hp > 30` 走不同分支。
- 可根据权重触发随机事件。
- 战斗节点可输出 win/lose/escape。

### 10.4 第四阶段：导入、校验、Markdown

目标：文件可迁移、可评审、可给 AI 读。

任务：

- 实现 `.rpgstory.json` 导入。
- 实现 Zod 校验错误展示。
- 实现图完整性校验。
- 实现 Markdown 导出。
- 实现 Markdown 预览。
- 实现不可达节点警告。

验收：

- 导出的 JSON 能重新导入。
- `mark.md` 可清楚展示世界观、角色、物品、节点流程、状态变更。

### 10.5 第五阶段：AI 生成

目标：AI 能辅助生成结构化剧情草稿。

任务：

- 实现 AI provider 配置。
- 实现 Chat Completions 调用。
- 实现世界观生成。
- 实现角色生成。
- 实现后续分支生成。
- 实现 AI draft 列表。
- 实现采纳/丢弃草稿。
- 实现输出校验和修复重试。

验收：

- 输入题材后可生成 world/items。
- 基于世界观可生成 actors。
- 选中节点后可生成后续分支 nodes/edges。
- AI 输出不会绕过校验直接写入主项目。

### 10.6 第六阶段：工程化与体验

目标：让原型接近可内部试用。

任务：

- 自动保存。
- 快捷键。
- 节点搜索。
- 节点复制粘贴。
- 执行日志时间线。
- 状态变更高亮。
- 导入导出错误定位。
- 单元测试和快照测试。

验收：

- 团队可以用它制作一个 15 到 30 分钟 RPG 序章剧情。
- 导出的 JSON 可被游戏运行时或后续工具消费。
- Markdown 可用于策划评审和 AI 上下文复用。

## 11. 建议测试清单

### 11.1 单元测试

- `evaluateCondition`：比较、逻辑、函数调用。
- `applyEffect`：set/inc/dec/append/remove/toggle。
- `resolveNextNode`：端口、guard、无连线。
- `weightedRandom`：权重与 seed。
- `importProject`：schema 校验和错误提示。
- `exportMarkdown`：节点顺序和环路处理。

### 11.2 集成测试

- start -> story -> choice -> mutation -> end。
- condition 根据玩家属性走不同分支。
- random 节点输出可复现。
- combat 输出 win/lose 后状态不同。
- JSON 导出后再导入保持数据一致。

### 11.3 AI 测试

- AI 输出字段缺失时能被拦截。
- AI 生成重复 ID 时能被拦截。
- AI 引用不存在 actor/item 时能被拦截。
- AI 条件表达式非法时能被拦截。
- 修复重试能够生成合格 JSON。

## 12. 原型最小闭环

最小可用版本建议只实现：

- 世界观基础字段。
- 玩家/NPC/物品列表。
- start/story/choice/mutation/end 五类节点。
- choice effects。
- JSON 导入导出。
- Markdown 导出。
- AI 生成后续 choice/story/mutation 节点。

最小闭环示例：

```text
start
  -> story: 主角醒来
  -> choice: 求助 / 隐藏物品
  -> mutation: 修改 Elena 好感或玩家勇气
  -> story: 不同结果叙述
  -> end
```

该闭环能证明产品最核心能力：

- 节点编辑。
- 玩家选择。
- 状态变化。
- 分支跳转。
- 文件保存。
- 文档导出。
- AI 续写。

