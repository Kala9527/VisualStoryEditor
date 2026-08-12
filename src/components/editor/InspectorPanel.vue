<script setup lang="ts">
import { computed, ref } from "vue";
import AiTextGeneratorModal from "./AiTextGeneratorModal.vue";
import EffectListEditor from "./EffectListEditor.vue";
import type {
  Actor,
  AttributeDef,
  AttributeValue,
  ChoiceNode,
  CombatNode,
  ConditionNode,
  Effect,
  EntityScope,
  MutationNode,
  NodeType,
  RandomNode,
  StoryNode,
  EndNode,
  WorkflowNode
} from "../../domain/types";
import { useProjectStore } from "../../stores/projectStore";
import {
  createDefaultChoice,
  createDefaultCondition,
  createDefaultEffect
} from "../../stores/workflowStore";
import { useWorkflowStore } from "../../stores/workflowStore";

const projectStore = useProjectStore();
const workflowStore = useWorkflowStore();
const isStoryGeneratorOpen = ref(false);
const importJsonText = ref("");
const importJsonError = ref("");
const newGlobalVariable = ref({ key: "", value: "0" });
const newGlobalFlag = ref({ key: "", value: true });
const newActor = ref({ id: "", name: "", role: "npc" as Actor["role"] });
const newActorAttribute = ref({ actorId: "", key: "", value: "0" });
const newActorFlag = ref({ actorId: "", key: "", value: true });

const node = computed(() => workflowStore.selectedNode);
const edge = computed(() => workflowStore.selectedEdge);
const effectTargets = computed(() => (node.value ? buildAvailableEffectTargets(node.value.id) : []));
const combatActorOptions = computed(() => {
  const actors = projectStore.project?.actors ?? [];
  return [
    ...actors.filter((actor) => actor.role === "enemy"),
    ...actors.filter((actor) => actor.role !== "enemy" && actor.role !== "player")
  ];
});
const projectStateJson = computed(() =>
  projectStore.project
    ? JSON.stringify(
        {
          attributeDefs: projectStore.project.attributeDefs,
          actors: projectStore.project.actors,
          state: projectStore.project.state
        },
        null,
        2
      )
    : "{}"
);
const storyGenerationContext = computed(() =>
  node.value?.type === "story" ? buildStoryGenerationContext(node.value) : ""
);
const storyGenerationPrompt = computed(() =>
  node.value?.type === "story"
    ? [
        `请为剧情节点「${node.value.title}」生成一段剧情正文。`,
        "要求：适合直接填入节点，保留后续分支空间，语言有画面感但不要冗长。",
        node.value.content ? `可参考或重写当前正文：\n${node.value.content}` : ""
      ]
        .filter(Boolean)
        .join("\n\n")
    : ""
);

const nodeTypes: NodeType[] = [
  "start",
  "story",
  "choice",
  "condition",
  "random",
  "mutation",
  "combat",
  "end"
];

const commitNode = () => {
  if (node.value) {
    projectStore.updateNode(node.value);
  }
};

const addChoice = (choiceNode: ChoiceNode) => {
  const choice = createDefaultChoice();
  choiceNode.choices.push(choice);
  choiceNode.outputPorts.push(`choice:${choice.id}`);
  projectStore.updateNode(choiceNode);
};

const removeChoice = (choiceNode: ChoiceNode, choiceId: string) => {
  choiceNode.choices = choiceNode.choices.filter((choice) => choice.id !== choiceId);
  choiceNode.outputPorts = choiceNode.outputPorts.filter((port) => port !== `choice:${choiceId}`);
  projectStore.updateNode(choiceNode);
};

const addConditionBranch = (conditionNode: ConditionNode) => {
  const index = conditionNode.branches.length + 1;
  const port = `branch_${index}`;
  conditionNode.branches.push({
    port,
    label: `分支 ${index}`,
    condition: createDefaultCondition(`分支 ${index}`)
  });
  conditionNode.outputPorts.push(port);
  projectStore.updateNode(conditionNode);
};

const removeConditionBranch = (conditionNode: ConditionNode, port: string) => {
  conditionNode.branches = conditionNode.branches.filter((branch) => branch.port !== port);
  conditionNode.outputPorts = conditionNode.outputPorts.filter((entry) => entry !== port);
  projectStore.updateNode(conditionNode);
};

const addRandomBranch = (randomNode: RandomNode) => {
  const index = randomNode.branches.length + 1;
  const port = `branch_${index}`;
  randomNode.branches.push({
    port,
    label: `随机 ${index}`,
    weight: 10
  });
  randomNode.outputPorts.push(port);
  projectStore.updateNode(randomNode);
};

const removeRandomBranch = (randomNode: RandomNode, port: string) => {
  randomNode.branches = randomNode.branches.filter((branch) => branch.port !== port);
  randomNode.outputPorts = randomNode.outputPorts.filter((entry) => entry !== port);
  projectStore.updateNode(randomNode);
};

const addEffectToList = (effects: Effect[]) => {
  const effect = createDefaultEffect();
  const firstTarget = effectTargets.value[0];

  if (firstTarget) {
    effect.target = {
      scope: firstTarget.scope,
      actorId: firstTarget.scope === "npc" ? firstTarget.actorId : undefined,
      path: firstTarget.path
    };
  }

  effects.push(effect);
  commitNode();
};

const addEffect = (target: { effects: Effect[] }) => {
  addEffectToList(target.effects);
};

const addChoiceEffect = (choice: { effects?: Effect[] }) => {
  choice.effects ??= [];
  addEffectToList(choice.effects);
};

const removeEffect = (effects: Effect[], effectId: string) => {
  const index = effects.findIndex((effect) => effect.id === effectId);
  if (index >= 0) {
    effects.splice(index, 1);
    commitNode();
  }
};

const updateEdgeLabel = (value: string) => {
  const currentEdge = edge.value;
  const project = projectStore.project;

  if (!currentEdge || !project) {
    return;
  }

  currentEdge.label = value;
  projectStore.markDirty();
};

const updateEdgeLabelFromEvent = (event: Event) => {
  updateEdgeLabel((event.target as HTMLInputElement).value);
};

const removeSelected = () => workflowStore.removeSelected();

const updateProjectSetupFromEvent = (event: Event) => {
  importJsonText.value = (event.target as HTMLTextAreaElement).value;
};

const importProjectSetupJson = () => {
  const project = projectStore.project;

  if (!project) {
    return;
  }

  try {
    const parsed = JSON.parse(importJsonText.value) as Partial<{
      attributeDefs: AttributeDef[];
      actors: Actor[];
      state: typeof project.state;
    }>;

    if (parsed.attributeDefs !== undefined && !Array.isArray(parsed.attributeDefs)) {
      throw new Error("attributeDefs 必须是数组。");
    }
    if (parsed.actors !== undefined && !Array.isArray(parsed.actors)) {
      throw new Error("actors 必须是数组。");
    }
    if (parsed.state !== undefined && (typeof parsed.state !== "object" || parsed.state === null)) {
      throw new Error("state 必须是对象。");
    }

    if (parsed.attributeDefs) {
      project.attributeDefs = parsed.attributeDefs;
    }
    if (parsed.actors) {
      project.actors = parsed.actors;
    }
    if (parsed.state) {
      project.state = parsed.state;
    }

    projectStore.markDirty();
    importJsonError.value = "";
  } catch (error) {
    importJsonError.value = error instanceof Error ? error.message : String(error);
  }
};

const loadProjectSetupJson = () => {
  importJsonText.value = projectStateJson.value;
  importJsonError.value = "";
};

const addGlobalVariable = () => {
  const project = projectStore.project;
  const key = newGlobalVariable.value.key.trim();

  if (!project || !key) {
    return;
  }

  project.state.global.variables[key] = parseAttributeValue(newGlobalVariable.value.value);
  projectStore.markDirty();
  newGlobalVariable.value = { key: "", value: "0" };
};

const addGlobalFlag = () => {
  const project = projectStore.project;
  const key = newGlobalFlag.value.key.trim();

  if (!project || !key) {
    return;
  }

  project.state.global.flags[key] = Boolean(newGlobalFlag.value.value);
  projectStore.markDirty();
  newGlobalFlag.value = { key: "", value: true };
};

const addActor = () => {
  const project = projectStore.project;
  const id = newActor.value.id.trim();

  if (!project || !id || project.actors.some((actor) => actor.id === id)) {
    return;
  }

  project.actors.push({
    id,
    name: newActor.value.name.trim() || id,
    role: newActor.value.role,
    summary: "",
    attributes: {},
    inventory: [],
    flags: {},
    relations: {}
  });

  if (!project.state.playerId || newActor.value.role === "player") {
    project.state.playerId = id;
  }

  projectStore.markDirty();
  newActor.value = { id: "", name: "", role: "npc" };
};

const addActorAttribute = () => {
  const project = projectStore.project;
  const actor = project?.actors.find((entry) => entry.id === newActorAttribute.value.actorId);
  const key = newActorAttribute.value.key.trim();

  if (!actor || !key) {
    return;
  }

  actor.attributes[key] = parseAttributeValue(newActorAttribute.value.value);
  projectStore.markDirty();
  newActorAttribute.value = { actorId: actor.id, key: "", value: "0" };
};

const addActorFlag = () => {
  const project = projectStore.project;
  const actor = project?.actors.find((entry) => entry.id === newActorFlag.value.actorId);
  const key = newActorFlag.value.key.trim();

  if (!actor || !key) {
    return;
  }

  actor.flags[key] = Boolean(newActorFlag.value.value);
  projectStore.markDirty();
  newActorFlag.value = { actorId: actor.id, key: "", value: true };
};

const hasCombatActorOption = (actorId: string) =>
  combatActorOptions.value.some((actor) => actor.id === actorId);

const addCombatEnemy = (combatNode: CombatNode) => {
  const usedActorIds = new Set(combatNode.enemies.map((enemy) => enemy.actorId));
  const actor = combatActorOptions.value.find((entry) => !usedActorIds.has(entry.id)) ?? combatActorOptions.value[0];

  if (!actor) {
    return;
  }

  combatNode.enemies.push({ actorId: actor.id, level: 1 });
  commitNode();
};

const removeCombatEnemy = (combatNode: CombatNode, index: number) => {
  combatNode.enemies.splice(index, 1);
  commitNode();
};

const applyGeneratedStory = (text: string) => {
  const currentNode = node.value;

  if (!currentNode || currentNode.type !== "story") {
    return;
  }

  currentNode.content = text;
  projectStore.updateNode(currentNode);
  isStoryGeneratorOpen.value = false;
};

const asStory = (value: WorkflowNode) => value as StoryNode;
const asChoice = (value: WorkflowNode) => value as ChoiceNode;
const asCondition = (value: WorkflowNode) => value as ConditionNode;
const asRandom = (value: WorkflowNode) => value as RandomNode;
const asMutation = (value: WorkflowNode) => value as MutationNode;
const asCombat = (value: WorkflowNode) => value as CombatNode;
const asEnd = (value: WorkflowNode) => value as EndNode;

function buildStoryGenerationContext(currentNode: StoryNode): string {
  const project = projectStore.project;

  if (!project) {
    return "";
  }

  const upstreamNodes = collectUpstreamNodes(currentNode.id);

  return [
    `项目：${project.meta.title}`,
    `世界观：${project.world.premise}`,
    `叙事基调：${project.world.tone}`,
    project.world.locations.length
      ? `地点：${project.world.locations.map((location) => `${location.id}=${location.name}：${location.summary}`).join("\n")}`
      : "",
    upstreamNodes.length
      ? `前置剧情上下文：\n${upstreamNodes.map((entry) => describeNode(entry)).join("\n\n")}`
      : "前置剧情上下文：当前节点没有前置连线。",
    `当前节点：${currentNode.id} / ${currentNode.title}`,
    currentNode.speakerId ? `说话人：${currentNode.speakerId}` : "",
    currentNode.locationId ? `地点 ID：${currentNode.locationId}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function collectUpstreamNodes(nodeId: string): WorkflowNode[] {
  const project = projectStore.project;

  if (!project) {
    return [];
  }

  const result: WorkflowNode[] = [];
  const visited = new Set<string>();
  const visit = (targetNodeId: string, depth: number) => {
    if (depth > 6) {
      return;
    }

    project.workflow.edges
      .filter((edge) => edge.to.nodeId === targetNodeId)
      .forEach((edge) => {
        const source = project.workflow.nodes[edge.from.nodeId];
        if (!source || visited.has(source.id)) {
          return;
        }

        visited.add(source.id);
        visit(source.id, depth + 1);
        result.push(source);
      });
  };

  visit(nodeId, 0);
  return result;
}

function describeNode(value: WorkflowNode): string {
  if (value.type === "story") {
    return `[${value.id}] ${value.title}\n${value.content}`;
  }

  if (value.type === "choice") {
    return `[${value.id}] ${value.title}\n${value.prompt}\n选项：${value.choices.map((choice) => choice.text).join(" / ")}`;
  }

  if (value.type === "condition") {
    return `[${value.id}] ${value.title}\n判断：${value.branches.map((branch) => `${branch.label}=${branch.condition.expression}`).join("；")}`;
  }

  if (value.type === "random") {
    return `[${value.id}] ${value.title}\n随机：${value.branches.map((branch) => `${branch.label}(${branch.weight})`).join("；")}`;
  }

  return `[${value.id}] ${value.title}（${value.type}）`;
}

function buildAvailableEffectTargets(currentNodeId: string) {
  const project = projectStore.project;

  if (!project) {
    return [];
  }

  const reachableNodeIds = collectReachableBefore(currentNodeId);
  const actorIds = new Set(project.actors.map((actor) => actor.id));
  const options: Array<{
    key: string;
    label: string;
    scope: EntityScope;
    actorId?: string;
    path: string;
    currentValue?: unknown;
  }> = [];

  Object.entries(project.state.global.variables).forEach(([key, value]) => {
    options.push(createTargetOption("global", undefined, `variables.${key}`, `全局变量 / ${key}`, value));
  });
  Object.entries(project.state.global.flags).forEach(([key, value]) => {
    options.push(createTargetOption("global", undefined, `flags.${key}`, `全局标记 / ${key}`, value));
  });

  project.actors.forEach((actor) => {
    const scope: EntityScope = actor.id === project.state.playerId ? "player" : "npc";
    const actorId = scope === "npc" ? actor.id : undefined;

    Object.entries(actor.attributes).forEach(([key, value]) => {
      options.push(createTargetOption(scope, actorId, `attributes.${key}`, `${actor.name} / 属性 / ${key}`, value));
    });
    Object.entries(actor.flags).forEach(([key, value]) => {
      options.push(createTargetOption(scope, actorId, `flags.${key}`, `${actor.name} / 标记 / ${key}`, value));
    });
    Object.entries(actor.relations ?? {}).forEach(([key, value]) => {
      if (actorIds.has(key)) {
        options.push(createTargetOption(scope, actorId, `relations.${key}`, `${actor.name} / 关系 / ${key}`, value));
      }
    });
  });

  reachableNodeIds.forEach((nodeId) => {
    const priorNode = project.workflow.nodes[nodeId];
    if (!priorNode) {
      return;
    }

    collectEffectsFromNode(priorNode).forEach((effect) => {
      if (!options.some((option) => option.key === effectKey(effect))) {
        options.push(
          createTargetOption(
            effect.target.scope,
            effect.target.actorId,
            effect.target.path,
            `前置变更 / ${effect.target.scope}${effect.target.actorId ? `:${effect.target.actorId}` : ""} / ${effect.target.path}`,
            effect.value
          )
        );
      }
    });
  });

  return options;
}

function createTargetOption(
  scope: EntityScope,
  actorId: string | undefined,
  path: string,
  label: string,
  currentValue: unknown
) {
  const key = [scope, actorId ?? "", path].join("|");

  return {
    key,
    label,
    scope,
    actorId,
    path,
    currentValue
  };
}

function collectReachableBefore(targetNodeId: string): string[] {
  const project = projectStore.project;

  if (!project) {
    return [];
  }

  const result: string[] = [];
  const visited = new Set<string>();
  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    project.workflow.edges
      .filter((edge) => edge.to.nodeId === nodeId)
      .forEach((edge) => {
        visit(edge.from.nodeId);
        if (!result.includes(edge.from.nodeId)) {
          result.push(edge.from.nodeId);
        }
      });
  };

  visit(targetNodeId);
  return result;
}

function collectEffectsFromNode(value: WorkflowNode): Effect[] {
  if (value.type === "mutation") {
    return value.effects;
  }

  if (value.type === "choice") {
    return value.choices.flatMap((choice) => choice.effects ?? []);
  }

  if (value.type === "combat") {
    return [...(value.winEffects ?? []), ...(value.loseEffects ?? []), ...(value.escapeEffects ?? [])];
  }

  return [];
}

function effectKey(effect: Effect): string {
  return [effect.target.scope, effect.target.actorId ?? "", effect.target.path].join("|");
}

function parseAttributeValue(value: string): AttributeValue {
  const trimmed = value.trim();

  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return value;
}
</script>

<template>
  <aside class="inspector-panel" aria-label="属性面板">
    <header>
      <h2>属性</h2>
      <p v-if="node">{{ node.id }}</p>
      <p v-else-if="edge">{{ edge.id }}</p>
      <p v-else>未选择对象</p>
    </header>

    <section v-if="node" class="form-section">
      <label>
        节点类型
        <select v-model="node.type" disabled>
          <option v-for="type in nodeTypes" :key="type" :value="type">{{ type }}</option>
        </select>
      </label>

      <label>
        标题
        <input v-model="node.title" type="text" @input="commitNode" />
      </label>

      <div class="two-columns">
        <label>
          X
          <input v-model.number="node.position.x" type="number" @input="commitNode" />
        </label>
        <label>
          Y
          <input v-model.number="node.position.y" type="number" @input="commitNode" />
        </label>
      </div>

      <template v-if="node.type === 'start'">
        <div class="section-title">
          <h3>初始人物与属性</h3>
          <button type="button" @click="loadProjectSetupJson">载入当前 JSON</button>
        </div>

        <p class="hint-text">在这里导入或调整开局可用的属性、玩家、NPC 和全局状态。后续变更节点只能修改这些已出现的数据。</p>

        <div class="setup-section">
          <h3>手动添加</h3>

          <div class="setup-row">
            <input v-model="newGlobalVariable.key" type="text" placeholder="全局变量名，例如 fogLevel" />
            <input v-model="newGlobalVariable.value" type="text" placeholder="值，例如 3" />
            <button type="button" @click="addGlobalVariable">添加变量</button>
          </div>

          <div class="setup-row">
            <input v-model="newGlobalFlag.key" type="text" placeholder="全局标记名，例如 met_elena" />
            <select v-model="newGlobalFlag.value">
              <option :value="true">true</option>
              <option :value="false">false</option>
            </select>
            <button type="button" @click="addGlobalFlag">添加标记</button>
          </div>

          <div class="setup-row">
            <input v-model="newActor.id" type="text" placeholder="人物 ID，例如 npc_guard" />
            <input v-model="newActor.name" type="text" placeholder="人物名称" />
            <select v-model="newActor.role">
              <option value="player">player</option>
              <option value="companion">companion</option>
              <option value="npc">npc</option>
              <option value="enemy">enemy</option>
            </select>
            <button type="button" @click="addActor">添加人物</button>
          </div>

          <div class="setup-row">
            <select v-model="newActorAttribute.actorId">
              <option value="" disabled>选择人物</option>
              <option v-for="actor in projectStore.project?.actors ?? []" :key="actor.id" :value="actor.id">
                {{ actor.name }} / {{ actor.id }}
              </option>
            </select>
            <input v-model="newActorAttribute.key" type="text" placeholder="属性名，例如 hp" />
            <input v-model="newActorAttribute.value" type="text" placeholder="值，例如 80" />
            <button type="button" @click="addActorAttribute">添加属性</button>
          </div>

          <div class="setup-row">
            <select v-model="newActorFlag.actorId">
              <option value="" disabled>选择人物</option>
              <option v-for="actor in projectStore.project?.actors ?? []" :key="actor.id" :value="actor.id">
                {{ actor.name }} / {{ actor.id }}
              </option>
            </select>
            <input v-model="newActorFlag.key" type="text" placeholder="标记名，例如 met_player" />
            <select v-model="newActorFlag.value">
              <option :value="true">true</option>
              <option :value="false">false</option>
            </select>
            <button type="button" @click="addActorFlag">添加人物标记</button>
          </div>
        </div>

        <label>
          JSON 导入
          <textarea
            :value="importJsonText"
            rows="12"
            placeholder='{"attributeDefs":[],"actors":[],"state":{"playerId":"player","global":{"variables":{},"flags":{},"discoveredLocations":[]}}}'
            @input="updateProjectSetupFromEvent"
          />
        </label>

        <button type="button" @click="importProjectSetupJson">导入到项目</button>
        <p v-if="importJsonError" class="error-text">{{ importJsonError }}</p>

        <div class="snapshot-block">
          <h3>当前初始数据</h3>
          <pre>{{ projectStateJson }}</pre>
        </div>
      </template>

      <template v-else-if="node.type === 'story'">
        <div class="section-title">
          <h3>剧情正文</h3>
          <button type="button" @click="isStoryGeneratorOpen = true">AI 生成正文</button>
        </div>
        <label>
          <textarea v-model="asStory(node).content" rows="8" @input="commitNode" />
        </label>
        <label>
          说话人 ID
          <input v-model="asStory(node).speakerId" type="text" @input="commitNode" />
        </label>
        <label>
          地点 ID
          <input v-model="asStory(node).locationId" type="text" @input="commitNode" />
        </label>
      </template>

      <template v-else-if="node.type === 'choice'">
        <label>
          提示文本
          <textarea v-model="asChoice(node).prompt" rows="4" @input="commitNode" />
        </label>

        <div class="section-title">
          <h3>选项</h3>
          <button type="button" @click="addChoice(asChoice(node))">添加</button>
        </div>

        <article v-for="choice in asChoice(node).choices" :key="choice.id" class="nested-card">
          <label>
            选项 ID
            <input v-model="choice.id" type="text" @input="commitNode" />
          </label>
          <label>
            文本
            <input v-model="choice.text" type="text" @input="commitNode" />
          </label>
          <div class="section-title compact">
            <span>状态变更</span>
            <button type="button" @click="addChoiceEffect(choice)">添加</button>
          </div>
          <EffectListEditor
            :effects="choice.effects ?? []"
            :targets="effectTargets"
            @change="commitNode"
            @remove="removeEffect(choice.effects ?? [], $event)"
          />
          <button type="button" class="danger" @click="removeChoice(asChoice(node), choice.id)">删除选项</button>
        </article>
      </template>

      <template v-else-if="node.type === 'condition'">
        <div class="section-title">
          <h3>条件分支</h3>
          <button type="button" @click="addConditionBranch(asCondition(node))">添加</button>
        </div>

        <article v-for="branch in asCondition(node).branches" :key="branch.port" class="nested-card">
          <label>
            端口
            <input v-model="branch.port" type="text" @input="commitNode" />
          </label>
          <label>
            标签
            <input v-model="branch.label" type="text" @input="commitNode" />
          </label>
          <label>
            表达式
            <input v-model="branch.condition.expression" type="text" @input="commitNode" />
          </label>
          <button type="button" class="danger" @click="removeConditionBranch(asCondition(node), branch.port)">删除分支</button>
        </article>

        <label>
          默认端口
          <input v-model="asCondition(node).fallbackPort" type="text" @input="commitNode" />
        </label>
      </template>

      <template v-else-if="node.type === 'random'">
        <div class="section-title">
          <h3>随机分支</h3>
          <button type="button" @click="addRandomBranch(asRandom(node))">添加</button>
        </div>

        <article v-for="branch in asRandom(node).branches" :key="branch.port" class="nested-card">
          <label>
            端口
            <input v-model="branch.port" type="text" @input="commitNode" />
          </label>
          <label>
            标签
            <input v-model="branch.label" type="text" @input="commitNode" />
          </label>
          <label>
            权重
            <input v-model.number="branch.weight" min="1" type="number" @input="commitNode" />
          </label>
          <button type="button" class="danger" @click="removeRandomBranch(asRandom(node), branch.port)">删除分支</button>
        </article>
      </template>

      <template v-else-if="node.type === 'mutation'">
        <div class="section-title">
          <h3>状态变更</h3>
          <button type="button" @click="addEffect(asMutation(node))">添加</button>
        </div>

        <EffectListEditor
          :effects="asMutation(node).effects"
          :targets="effectTargets"
          @change="commitNode"
          @remove="removeEffect(asMutation(node).effects, $event)"
        />
      </template>

      <template v-else-if="node.type === 'combat'">
        <label>
          可逃跑
          <input v-model="asCombat(node).escapeAllowed" type="checkbox" @change="commitNode" />
        </label>

        <div class="section-title">
          <h3>敌人绑定</h3>
          <button type="button" :disabled="!combatActorOptions.length" @click="addCombatEnemy(asCombat(node))">添加敌人</button>
        </div>
        <p v-if="!combatActorOptions.length" class="hint-text">请先在开始节点配置 enemy、npc 或 companion 角色，再绑定到战斗节点。</p>
        <p v-else-if="!asCombat(node).enemies.length" class="hint-text">尚未绑定敌人；运行到该节点时仍可选择战斗结果，但建议先绑定角色 ID。</p>

        <article v-for="(enemy, index) in asCombat(node).enemies" :key="`${enemy.actorId}-${index}`" class="nested-card enemy-card">
          <label>
            角色 ID
            <select v-model="enemy.actorId" @change="commitNode">
              <option v-if="enemy.actorId && !hasCombatActorOption(enemy.actorId)" :value="enemy.actorId">
                缺失角色 / {{ enemy.actorId }}
              </option>
              <option v-for="actor in combatActorOptions" :key="actor.id" :value="actor.id">
                {{ actor.name }} / {{ actor.id }} / {{ actor.role }}
              </option>
            </select>
          </label>
          <div class="enemy-row">
            <label>
              等级
              <input v-model.number="enemy.level" min="1" type="number" @input="commitNode" />
            </label>
            <button type="button" class="danger" @click="removeCombatEnemy(asCombat(node), index)">移除敌人</button>
          </div>
        </article>

        <div class="section-title">
          <h3>胜利效果</h3>
          <button type="button" @click="asCombat(node).winEffects ??= []; addEffectToList(asCombat(node).winEffects!)">添加</button>
        </div>
        <EffectListEditor
          :effects="asCombat(node).winEffects ?? []"
          :targets="effectTargets"
          @change="commitNode"
          @remove="removeEffect(asCombat(node).winEffects ?? [], $event)"
        />

        <div class="section-title">
          <h3>失败效果</h3>
          <button type="button" @click="asCombat(node).loseEffects ??= []; addEffectToList(asCombat(node).loseEffects!)">添加</button>
        </div>
        <EffectListEditor
          :effects="asCombat(node).loseEffects ?? []"
          :targets="effectTargets"
          @change="commitNode"
          @remove="removeEffect(asCombat(node).loseEffects ?? [], $event)"
        />

        <div class="section-title">
          <h3>逃跑效果</h3>
          <button type="button" @click="asCombat(node).escapeEffects ??= []; addEffectToList(asCombat(node).escapeEffects!)">添加</button>
        </div>
        <EffectListEditor
          :effects="asCombat(node).escapeEffects ?? []"
          :targets="effectTargets"
          @change="commitNode"
          @remove="removeEffect(asCombat(node).escapeEffects ?? [], $event)"
        />
      </template>

      <template v-else-if="node.type === 'end'">
        <label>
          结局标题
          <input v-model="asEnd(node).endingTitle" type="text" @input="commitNode" />
        </label>
        <label>
          结局摘要
          <textarea v-model="asEnd(node).endingSummary" rows="4" @input="commitNode" />
        </label>
      </template>

      <button type="button" class="danger wide" @click="removeSelected">删除节点</button>
    </section>

    <section v-else-if="edge" class="form-section">
      <label>
        连线标签
        <input :value="edge.label" type="text" @input="updateEdgeLabelFromEvent" />
      </label>
      <dl class="edge-details">
        <div>
          <dt>From</dt>
          <dd>{{ edge.from.nodeId }} / {{ edge.from.port }}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{{ edge.to.nodeId }} / {{ edge.to.port }}</dd>
        </div>
      </dl>
      <button type="button" class="danger wide" @click="removeSelected">删除连线</button>
    </section>

    <section v-else class="empty-panel">
      <p>选择画布上的节点或连线后，可在这里编辑字段。</p>
    </section>

    <AiTextGeneratorModal
      :open="isStoryGeneratorOpen"
      title="AI 生成剧情正文"
      mode="story"
      :initial-prompt="storyGenerationPrompt"
      :context="storyGenerationContext"
      apply-label="填入剧情正文"
      @apply="applyGeneratedStory"
      @close="isStoryGeneratorOpen = false"
    />
  </aside>
</template>

<style scoped>
.inspector-panel {
  background: #ffffff;
  border-left: 1px solid #d9e1ec;
  display: grid;
  gap: 14px;
  grid-template-rows: auto 1fr;
  min-width: 420px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px;
}

header {
  border-bottom: 1px solid #e2e8f0;
  display: grid;
  gap: 4px;
  padding-bottom: 12px;
}

h2,
h3,
p {
  margin: 0;
}

h2 {
  color: #172033;
  font-size: 18px;
}

h3 {
  color: #172033;
  font-size: 14px;
}

header p,
.empty-panel p {
  color: #64748b;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.form-section {
  align-content: start;
  display: grid;
  gap: 12px;
}

label {
  color: #334155;
  display: grid;
  font-size: 12px;
  font-weight: 700;
  gap: 6px;
}

input,
select,
textarea {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #172033;
  font: inherit;
  font-size: 13px;
  min-width: 0;
  padding: 8px;
  width: 100%;
}

textarea {
  line-height: 1.5;
  resize: vertical;
}

button {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #334155;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  padding: 7px 10px;
}

button:hover {
  border-color: #2563eb;
  color: #1d4ed8;
}

.danger {
  border-color: #fecaca;
  color: #b91c1c;
}

.danger:hover {
  border-color: #ef4444;
  color: #991b1b;
}

.wide {
  width: 100%;
}

.two-columns {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.section-title {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.section-title.compact span {
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.nested-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: grid;
  gap: 10px;
  padding: 10px;
}

.setup-section,
.snapshot-block {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: grid;
  gap: 10px;
  padding: 10px;
}

.setup-row {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.setup-row button {
  min-width: 96px;
}

.enemy-card {
  gap: 8px;
}

.enemy-row {
  align-items: end;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.hint-text,
.error-text {
  font-size: 12px;
  line-height: 1.5;
}

.hint-text {
  color: #64748b;
}

.error-text {
  background: #fff1f1;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #b91c1c;
  padding: 8px;
}

pre {
  background: #0f172a;
  border-radius: 6px;
  color: #dbeafe;
  font-size: 11px;
  line-height: 1.5;
  margin: 0;
  overflow: visible;
  padding: 10px;
  white-space: pre-wrap;
}

.edge-details {
  display: grid;
  gap: 8px;
  margin: 0;
}

.edge-details div {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px;
}

.edge-details dt {
  color: #64748b;
  font-size: 11px;
}

.edge-details dd {
  color: #172033;
  font-size: 12px;
  margin: 3px 0 0;
  overflow-wrap: anywhere;
}

.empty-panel {
  align-items: center;
  display: grid;
  justify-items: center;
  min-height: 220px;
  text-align: center;
}
</style>
