import { defineStore } from "pinia";
import { toRaw } from "vue";
import type {
  Actor,
  AttributeValue,
  ChoiceNode,
  CombatNode,
  CombatResult,
  ConditionNode,
  Effect,
  EndNode,
  GameProject,
  ID,
  MutationNode,
  ProjectState,
  RandomNode,
  RuntimeLog,
  StateDiff,
  StoryNode,
  WorkflowEdge,
  WorkflowNode
} from "../domain/types";
import { useProjectStore } from "./projectStore";

type RuntimeStatus = "idle" | "running" | "waiting_choice" | "waiting_combat" | "ended" | "error";

interface RuntimeChoiceView {
  id: ID;
  text: string;
  enabled: boolean;
  visible: boolean;
  reason?: string;
}

const clone = <T>(value: T): T => {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(toRaw(value))) as T;
};

const createId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const getByPath = (source: unknown, path: string): unknown => {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, source);
};

const hasPath = (source: unknown, path: string): boolean => {
  return path.split(".").every((key) => {
    if (source && typeof source === "object" && key in source) {
      source = (source as Record<string, unknown>)[key];
      return true;
    }

    return false;
  });
};

const setByPath = (source: unknown, path: string, value: unknown) => {
  const parts = path.split(".");
  let current = source as Record<string, unknown>;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];

    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
};

const toNumber = (value: unknown) => (typeof value === "number" ? value : Number(value) || 0);

const applyOperation = (before: unknown, effect: Effect): unknown => {
  switch (effect.op) {
    case "set":
      return effect.value;
    case "inc":
      return toNumber(before) + toNumber(effect.value);
    case "dec":
      return toNumber(before) - toNumber(effect.value);
    case "toggle":
      return !Boolean(before);
    case "append":
      return Array.isArray(before) ? [...before, effect.value] : [effect.value];
    case "remove":
      return Array.isArray(before) ? before.filter((entry) => entry !== effect.value) : before;
    default:
      return before;
  }
};

const resolveEffectRoot = (actors: Actor[], state: ProjectState, effect: Effect): unknown => {
  if (effect.target.scope === "global") {
    return state.global;
  }

  const actorId = effect.target.scope === "player" ? state.playerId : effect.target.actorId;
  return actors.find((actor) => actor.id === actorId);
};

const applyEffectFallback = (
  actors: Actor[],
  state: ProjectState,
  effect: Effect
): StateDiff | null => {
  const root = resolveEffectRoot(actors, state, effect);

  if (!root) {
    return null;
  }
  if (!hasPath(root, effect.target.path)) {
    throw new Error(`变更目标不存在或尚未出现：${effect.target.scope}.${effect.target.actorId ? `${effect.target.actorId}.` : ""}${effect.target.path}`);
  }

  const before = clone(getByPath(root, effect.target.path));
  const after = applyOperation(before, effect);
  setByPath(root, effect.target.path, after);

  return {
    path: `${effect.target.scope}.${effect.target.actorId ?? state.playerId}.${effect.target.path}`,
    before,
    after
  };
};

const evaluateConditionFallback = (expression: string, actors: Actor[], state: ProjectState): boolean => {
  const player = actors.find((actor) => actor.id === state.playerId);
  const actorsById: Record<ID, Actor> = Object.fromEntries(actors.map((actor) => [actor.id, actor]));

  const normalized = expression.trim();
  if (!normalized) {
    return true;
  }

  const resolveToken = (token: string): unknown => {
    if (token === "true") {
      return true;
    }
    if (token === "false") {
      return false;
    }
    if (/^-?\d+(\.\d+)?$/.test(token)) {
      return Number(token);
    }
    if (/^".*"$/.test(token) || /^'.*'$/.test(token)) {
      return token.slice(1, -1);
    }
    if (token.startsWith("player.")) {
      return getByPath(player, token.replace(/^player\./, ""));
    }
    if (token.startsWith("global.")) {
      return getByPath(state.global, token.replace(/^global\./, ""));
    }
    if (token.startsWith("npc.")) {
      const [, actorId, ...path] = token.split(".");
      return getByPath(actorsById[actorId], path.join("."));
    }

    return undefined;
  };

  const compare = (left: unknown, operator: string, right: unknown) => {
    switch (operator) {
      case "==":
        return left === right;
      case "!=":
        return left !== right;
      case ">":
        return toNumber(left) > toNumber(right);
      case ">=":
        return toNumber(left) >= toNumber(right);
      case "<":
        return toNumber(left) < toNumber(right);
      case "<=":
        return toNumber(left) <= toNumber(right);
      default:
        return Boolean(left);
    }
  };

  return normalized
    .split("||")
    .some((orPart) =>
      orPart
        .split("&&")
        .every((andPart) => {
          const match = andPart.trim().match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);

          if (!match) {
            return Boolean(resolveToken(andPart.trim()));
          }

          return compare(resolveToken(match[1].trim()), match[2], resolveToken(match[3].trim()));
        })
    );
};

const findEdge = (
  edges: WorkflowEdge[],
  nodeId: ID,
  port: string,
  actors: Actor[],
  state: ProjectState
) => {
  return edges.find((edge) => {
    if (edge.from.nodeId !== nodeId || edge.from.port !== port) {
      return false;
    }

    if (!edge.guard) {
      return true;
    }

    return evaluateConditionFallback(edge.guard.expression, actors, state);
  });
};

const describeCombatEnemies = (combat: CombatNode, actors: Actor[]): string => {
  if (combat.enemies.length === 0) {
    return "未绑定敌人";
  }

  return combat.enemies
    .map((enemy) => {
      const actor = actors.find((entry) => entry.id === enemy.actorId);
      const label = actor ? `${actor.name} (${actor.id})` : `缺失角色：${enemy.actorId}`;
      return enemy.level === undefined ? label : `${label} Lv.${enemy.level}`;
    })
    .join("、");
};

const getCombatEffects = (combat: CombatNode, result: CombatResult): Effect[] => {
  if (result === "win") {
    return combat.winEffects ?? [];
  }

  if (result === "lose" || result === "dead") {
    return combat.loseEffects ?? [];
  }

  return combat.escapeEffects ?? [];
};

export const useRuntimeStore = defineStore("runtime", {
  state: () => ({
    status: "idle" as RuntimeStatus,
    currentNodeId: null as ID | null,
    stateSnapshot: null as ProjectState | null,
    actorSnapshots: [] as Actor[],
    history: [] as RuntimeLog[],
    visibleChoices: [] as RuntimeChoiceView[],
    lastError: "",
    lastNarration: "",
    ending: null as Pick<EndNode, "endingId" | "endingTitle" | "endingSummary"> | null
  }),

  getters: {
    running: (state) =>
      state.status === "running" || state.status === "waiting_choice" || state.status === "waiting_combat",

    currentNode(): WorkflowNode | null {
      const projectStore = useProjectStore();

      if (!projectStore.project || !this.currentNodeId) {
        return null;
      }

      return projectStore.project.workflow.nodes[this.currentNodeId] ?? null;
    }
  },

  actions: {
    start(project?: GameProject) {
      const projectStore = useProjectStore();
      const source = project ?? projectStore.project;

      if (!source) {
        this.status = "error";
        this.lastError = "请先加载项目。";
        return;
      }

      this.status = "running";
      this.currentNodeId = source.workflow.startNodeId;
      this.stateSnapshot = clone(source.state);
      this.actorSnapshots = clone(source.actors);
      this.history = [];
      this.visibleChoices = [];
      this.lastError = "";
      this.lastNarration = "";
      this.ending = null;
      this.step();
    },

    stop() {
      this.status = "idle";
      this.currentNodeId = null;
      this.visibleChoices = [];
      this.lastNarration = "";
    },

    step() {
      const projectStore = useProjectStore();
      const project = projectStore.project;

      if (!project || !this.currentNodeId || !this.stateSnapshot) {
        this.status = "error";
        this.lastError = "运行时缺少项目或状态快照。";
        return;
      }

      const node = project.workflow.nodes[this.currentNodeId];
      if (!node) {
        this.status = "error";
        this.lastError = `节点 ${this.currentNodeId} 不存在。`;
        return;
      }

      this.visibleChoices = [];

      switch (node.type) {
        case "start":
          this.advance("out", node, []);
          break;

        case "story":
          this.status = "running";
          this.lastNarration = (node as StoryNode).content;
          break;

        case "choice":
          this.status = "waiting_choice";
          this.lastNarration = (node as ChoiceNode).prompt;
          this.visibleChoices = (node as ChoiceNode).choices.map((choice) => {
            const visible = (choice.visibleWhen ?? []).every((condition) =>
              evaluateConditionFallback(condition.expression, this.actorSnapshots, this.stateSnapshot as ProjectState)
            );
            const enabled = (choice.enabledWhen ?? []).every((condition) =>
              evaluateConditionFallback(condition.expression, this.actorSnapshots, this.stateSnapshot as ProjectState)
            );

            return {
              id: choice.id,
              text: choice.text,
              visible,
              enabled,
              reason: enabled ? undefined : "条件未满足"
            };
          });
          break;

        case "condition": {
          const conditionNode = node as ConditionNode;
          const branch = conditionNode.branches.find((entry) =>
            evaluateConditionFallback(entry.condition.expression, this.actorSnapshots, this.stateSnapshot as ProjectState)
          );
          this.advance(branch?.port ?? conditionNode.fallbackPort, node, []);
          break;
        }

        case "random": {
          const randomNode = node as RandomNode;
          const total = randomNode.branches.reduce((sum, branch) => sum + Math.max(0, branch.weight), 0);
          let roll = Math.random() * total;
          const branch = randomNode.branches.find((entry) => {
            roll -= Math.max(0, entry.weight);
            return roll <= 0;
          });

          this.advance(branch?.port ?? randomNode.branches[0]?.port ?? "out", node, []);
          break;
        }

        case "mutation": {
          const diffs = this.applyEffects((node as MutationNode).effects);
          if (!diffs) {
            return;
          }
          this.advance("out", node, diffs);
          break;
        }

        case "combat": {
          const combat = node as CombatNode;
          this.status = "waiting_combat";
          this.lastNarration = `遭遇战斗：${describeCombatEnemies(combat, this.actorSnapshots)}\n请选择本次战斗结果。`;
          break;
        }

        case "end":
          this.status = "ended";
          this.ending = {
            endingId: (node as EndNode).endingId,
            endingTitle: (node as EndNode).endingTitle,
            endingSummary: (node as EndNode).endingSummary
          };
          this.writeLog(node, [], undefined);
          break;

        default:
          this.status = "error";
          this.lastError = `暂未支持节点类型 ${(node as WorkflowNode).type}。`;
      }
    },

    continueStory() {
      const node = this.currentNode;

      if (!node || node.type !== "story") {
        return;
      }

      this.advance("out", node, []);
    },

    choose(choiceId: ID) {
      const projectStore = useProjectStore();
      const project = projectStore.project;
      const node = this.currentNode;

      if (!project || !this.stateSnapshot || !node || node.type !== "choice") {
        return;
      }

      const choiceNode = node as ChoiceNode;
      const choice = choiceNode.choices.find((entry) => entry.id === choiceId);
      const view = this.visibleChoices.find((entry) => entry.id === choiceId);

      if (!choice || view?.enabled === false || view?.visible === false) {
        return;
      }

      const diffs = this.applyEffects(choice.effects ?? []);
      if (!diffs) {
        return;
      }
      this.advance(`choice:${choice.id}`, node, diffs, choice.id);
    },

    resolveCombat(result: CombatResult) {
      const node = this.currentNode;

      if (!node || node.type !== "combat" || this.status !== "waiting_combat") {
        return;
      }

      const combat = node as CombatNode;
      if (result === "escape" && !combat.escapeAllowed) {
        this.lastError = "该战斗节点未开启逃跑出口。";
        return;
      }

      if (!combat.outputPorts.includes(result)) {
        this.lastError = `战斗节点缺少 ${result} 输出端口。`;
        return;
      }

      this.lastError = "";
      const diffs = this.applyEffects(getCombatEffects(combat, result));
      if (!diffs) {
        return;
      }

      this.advance(result, node, diffs, undefined, result);
    },

    applyEffects(effects: Effect[]): StateDiff[] | null {
      const projectStore = useProjectStore();
      const project = projectStore.project;

      if (!project || !this.stateSnapshot) {
        return null;
      }

      try {
        return effects
          .map((effect) => applyEffectFallback(this.actorSnapshots, this.stateSnapshot as ProjectState, effect))
          .filter((diff): diff is StateDiff => Boolean(diff));
      } catch (error) {
        this.status = "error";
        this.lastError = error instanceof Error ? error.message : String(error);
        return null;
      }
    },

    advance(
      port: string,
      node: WorkflowNode,
      diffs: StateDiff[],
      selectedChoiceId?: ID,
      combatResult?: CombatResult
    ) {
      const projectStore = useProjectStore();
      const project = projectStore.project;

      if (!project || !this.stateSnapshot) {
        return;
      }

      const edge = findEdge(
        project.workflow.edges,
        node.id,
        port,
        this.actorSnapshots,
        this.stateSnapshot
      );
      const nextNodeId = edge?.to.nodeId;
      this.writeLog(node, diffs, nextNodeId, selectedChoiceId, port, combatResult);

      if (!nextNodeId) {
        this.status = "ended";
        this.currentNodeId = null;
        this.lastNarration = "当前端口没有后续连线，运行结束。";
        return;
      }

      this.currentNodeId = nextNodeId;
      this.status = "running";
      this.step();
    },

    writeLog(
      node: WorkflowNode,
      diffs: StateDiff[],
      nextNodeId?: ID,
      selectedChoiceId?: ID,
      outputPort?: string,
      combatResult?: CombatResult
    ) {
      this.history.push({
        id: createId("log"),
        nodeId: node.id,
        nodeType: node.type,
        selectedChoiceId,
        outputPort,
        combatResult,
        diffs,
        nextNodeId,
        createdAt: new Date().toISOString()
      } as RuntimeLog);
    },

    rollback(logId: ID) {
      const index = this.history.findIndex((log) => log.id === logId);

      if (index < 0 || !this.stateSnapshot) {
        return;
      }

      for (const log of [...this.history.slice(index)].reverse()) {
        for (const diff of [...log.diffs].reverse()) {
          const [, actorIdOrSelf, ...pathParts] = diff.path.split(".");
          const path = pathParts.join(".");

          if (diff.path.startsWith("global.")) {
            setByPath(this.stateSnapshot.global, path, clone(diff.before));
          } else {
            const actorId = actorIdOrSelf === this.stateSnapshot.playerId ? this.stateSnapshot.playerId : actorIdOrSelf;
            const actor = this.actorSnapshots.find((entry) => entry.id === actorId);
            if (actor) {
              setByPath(actor, path, clone(diff.before));
            }
          }
        }
      }

      this.history = this.history.slice(0, index);
      this.currentNodeId = this.history.at(-1)?.nodeId ?? null;
      this.status = this.currentNodeId ? "running" : "idle";
    }
  }
});
