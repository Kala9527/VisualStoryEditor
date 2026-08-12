import type { Effect, GameProject, WorkflowEdge, WorkflowNode } from "../domain/types";

export type ValidationSeverity = "error" | "warning";

export interface ProjectValidationIssue {
  severity: ValidationSeverity;
  path: string;
  message: string;
}

export interface ProjectValidationResult {
  valid: boolean;
  errors: ProjectValidationIssue[];
  warnings: ProjectValidationIssue[];
  issues: ProjectValidationIssue[];
}

export function validateProjectBasic(input: unknown): ProjectValidationResult {
  const issues: ProjectValidationIssue[] = [];

  if (!isRecord(input)) {
    return result([
      {
        severity: "error",
        path: "$",
        message: "项目根对象必须是 JSON object。"
      }
    ]);
  }

  if (input.schemaVersion !== "1.0") {
    issues.push({
      severity: "error",
      path: "schemaVersion",
      message: "当前原型仅支持 schemaVersion = 1.0。"
    });
  }

  requireRecord(input, "meta", issues);
  requireString(input.meta, "title", "meta.title", issues);
  requireString(input.meta, "createdAt", "meta.createdAt", issues);
  requireString(input.meta, "updatedAt", "meta.updatedAt", issues);

  requireRecord(input, "world", issues);
  requireString(input.world, "premise", "world.premise", issues);
  requireString(input.world, "tone", "world.tone", issues);
  requireArray(input.world, "locations", "world.locations", issues);
  requireArray(input.world, "factions", "world.factions", issues);

  requireArray(input, "attributeDefs", "attributeDefs", issues);
  requireArray(input, "items", "items", issues);
  requireArray(input, "actors", "actors", issues);
  requireRecord(input, "state", issues);
  requireRecord(input, "workflow", issues);

  if (issues.some(issue => issue.severity === "error")) {
    return result(issues);
  }

  const project = input as unknown as GameProject;

  validateUniqueIds("attributeDefs", project.attributeDefs, "key", issues);
  validateUniqueIds("items", project.items, "id", issues);
  validateUniqueIds("actors", project.actors, "id", issues);
  validateUniqueIds("world.locations", project.world.locations, "id", issues);
  validateUniqueIds("world.factions", project.world.factions, "id", issues);

  validateActors(project, issues);
  validateState(project, issues);
  validateWorkflow(project, issues);

  return result(issues);
}

function validateActors(project: GameProject, issues: ProjectValidationIssue[]): void {
  const itemIds = new Set(project.items.map(item => item.id));
  const actorIds = new Set(project.actors.map(actor => actor.id));
  const locationIds = new Set(project.world.locations.map(location => location.id));
  const factionIds = new Set(project.world.factions.map(faction => faction.id));

  project.actors.forEach((actor, actorIndex) => {
    const path = `actors[${actorIndex}]`;
    if (!actor.id) {
      issues.push({ severity: "error", path: `${path}.id`, message: "角色缺少 id。" });
    }
    if (!actor.name) {
      issues.push({ severity: "error", path: `${path}.name`, message: "角色缺少 name。" });
    }
    if (!actorIds.has(actor.id)) {
      issues.push({ severity: "error", path: `${path}.id`, message: `角色 ${actor.id} 未能进入角色索引。` });
    }
    if (actor.locationId && !locationIds.has(actor.locationId)) {
      issues.push({
        severity: "error",
        path: `${path}.locationId`,
        message: `角色引用了不存在的地点：${actor.locationId}。`
      });
    }
    if (actor.factionId && !factionIds.has(actor.factionId)) {
      issues.push({
        severity: "error",
        path: `${path}.factionId`,
        message: `角色引用了不存在的阵营：${actor.factionId}。`
      });
    }
    actor.inventory?.forEach((entry, entryIndex) => {
      if (!itemIds.has(entry.itemId)) {
        issues.push({
          severity: "error",
          path: `${path}.inventory[${entryIndex}].itemId`,
          message: `背包引用了不存在的物品：${entry.itemId}。`
        });
      }
    });
  });
}

function validateState(project: GameProject, issues: ProjectValidationIssue[]): void {
  const actorIds = new Set(project.actors.map(actor => actor.id));
  const locationIds = new Set(project.world.locations.map(location => location.id));

  if (!actorIds.has(project.state.playerId)) {
    issues.push({
      severity: "error",
      path: "state.playerId",
      message: `playerId 指向不存在的角色：${project.state.playerId}。`
    });
  }

  project.state.global.discoveredLocations.forEach((locationId, index) => {
    if (!locationIds.has(locationId)) {
      issues.push({
        severity: "error",
        path: `state.global.discoveredLocations[${index}]`,
        message: `已发现地点不存在：${locationId}。`
      });
    }
  });
}

function validateWorkflow(project: GameProject, issues: ProjectValidationIssue[]): void {
  const graph = project.workflow;
  const nodes = graph.nodes;
  const nodeIds = Object.keys(nodes);
  const nodeIdSet = new Set(nodeIds);

  if (!graph.startNodeId || !nodeIdSet.has(graph.startNodeId)) {
    issues.push({
      severity: "error",
      path: "workflow.startNodeId",
      message: `startNodeId 指向不存在的节点：${graph.startNodeId}。`
    });
  }

  const startNodes = Object.values(nodes).filter(node => node.type === "start");
  if (startNodes.length !== 1) {
    issues.push({
      severity: "error",
      path: "workflow.nodes",
      message: `项目必须且只能有一个 start 节点，当前数量：${startNodes.length}。`
    });
  }

  const endNodes = Object.values(nodes).filter(node => node.type === "end");
  if (endNodes.length === 0) {
    issues.push({
      severity: "warning",
      path: "workflow.nodes",
      message: "项目没有 end 节点，运行时可能无法自然结束。"
    });
  }

  Object.values(nodes).forEach(node => validateNode(node, project, issues));
  graph.edges.forEach((edge, index) => validateEdge(edge, index, nodes, issues));
  validateReachability(project, issues);
}

function validateNode(node: WorkflowNode, project: GameProject, issues: ProjectValidationIssue[]): void {
  const path = `workflow.nodes.${node.id}`;
  if (!node.id) {
    issues.push({ severity: "error", path, message: "节点缺少 id。" });
  }
  if (!node.title) {
    issues.push({ severity: "warning", path: `${path}.title`, message: "节点缺少标题。" });
  }
  if (!Array.isArray(node.inputPorts)) {
    issues.push({ severity: "error", path: `${path}.inputPorts`, message: "inputPorts 必须是数组。" });
  }
  if (!Array.isArray(node.outputPorts)) {
    issues.push({ severity: "error", path: `${path}.outputPorts`, message: "outputPorts 必须是数组。" });
  }

  if (node.type === "choice") {
    const choiceIds = new Set<string>();
    node.choices.forEach((choice, index) => {
      if (choiceIds.has(choice.id)) {
        issues.push({
          severity: "error",
          path: `${path}.choices[${index}].id`,
          message: `选项 id 重复：${choice.id}。`
        });
      }
      choiceIds.add(choice.id);
      const expectedPort = `choice:${choice.id}`;
      if (!hasPort(node.outputPorts, expectedPort)) {
        issues.push({
          severity: "warning",
          path: `${path}.outputPorts`,
          message: `选项 ${choice.id} 建议提供输出端口 ${expectedPort}。`
        });
      }
      validateEffects(choice.effects ?? [], `${path}.choices[${index}].effects`, project, issues);
    });
  }

  if (node.type === "condition") {
    node.branches.forEach((branch, index) => {
      if (!hasPort(node.outputPorts, branch.port)) {
        issues.push({
          severity: "error",
          path: `${path}.branches[${index}].port`,
          message: `条件分支端口不存在：${branch.port}。`
        });
      }
      if (!branch.condition?.expression) {
        issues.push({
          severity: "error",
          path: `${path}.branches[${index}].condition.expression`,
          message: "条件分支缺少表达式。"
        });
      }
    });
    if (!hasPort(node.outputPorts, node.fallbackPort)) {
      issues.push({
        severity: "error",
        path: `${path}.fallbackPort`,
        message: `fallbackPort 不存在：${node.fallbackPort}。`
      });
    }
  }

  if (node.type === "random") {
    node.branches.forEach((branch, index) => {
      if (branch.weight <= 0) {
        issues.push({
          severity: "error",
          path: `${path}.branches[${index}].weight`,
          message: "随机分支权重必须大于 0。"
        });
      }
      if (!hasPort(node.outputPorts, branch.port)) {
        issues.push({
          severity: "error",
          path: `${path}.branches[${index}].port`,
          message: `随机分支端口不存在：${branch.port}。`
        });
      }
    });
  }

  if (node.type === "mutation") {
    validateEffects(node.effects, `${path}.effects`, project, issues);
  }

  if (node.type === "combat") {
    validateCombatEnemies(node, path, project, issues);
    validateEffects(node.winEffects ?? [], `${path}.winEffects`, project, issues);
    validateEffects(node.loseEffects ?? [], `${path}.loseEffects`, project, issues);
    validateEffects(node.escapeEffects ?? [], `${path}.escapeEffects`, project, issues);
  }
}

function validateCombatEnemies(
  node: Extract<WorkflowNode, { type: "combat" }>,
  path: string,
  project: GameProject,
  issues: ProjectValidationIssue[]
): void {
  const actorsById = new Map(project.actors.map((actor) => [actor.id, actor]));

  node.enemies.forEach((enemy, index) => {
    const actor = actorsById.get(enemy.actorId);

    if (!actor) {
      issues.push({
        severity: "error",
        path: `${path}.enemies[${index}].actorId`,
        message: `战斗敌人未绑定到已配置角色：${enemy.actorId}。`
      });
      return;
    }

    if (actor.role !== "enemy") {
      issues.push({
        severity: "warning",
        path: `${path}.enemies[${index}].actorId`,
        message: `战斗敌人 ${enemy.actorId} 的角色类型是 ${actor.role}，建议使用 enemy。`
      });
    }
  });
}

function validateEffects(
  effects: Effect[],
  path: string,
  project: GameProject,
  issues: ProjectValidationIssue[]
): void {
  effects.forEach((effect, index) => {
    const root = resolveEffectValidationRoot(effect, project);
    const effectPath = `${path}[${index}]`;

    if (!root) {
      issues.push({
        severity: "error",
        path: `${effectPath}.target`,
        message: `变更目标人物不存在或尚未在开始节点配置：${effect.target.actorId ?? effect.target.scope}。`
      });
      return;
    }

    if (!hasObjectPath(root, effect.target.path)) {
      issues.push({
        severity: "error",
        path: `${effectPath}.target.path`,
        message: `变更目标属性不存在或尚未在开始节点配置：${effect.target.path}。`
      });
    }
  });
}

function resolveEffectValidationRoot(effect: Effect, project: GameProject): unknown {
  if (effect.target.scope === "global") {
    return project.state.global;
  }

  if (effect.target.scope === "player") {
    return project.actors.find((actor) => actor.id === project.state.playerId);
  }

  if (effect.target.scope === "npc") {
    return project.actors.find((actor) => actor.id === effect.target.actorId);
  }

  return null;
}

function hasObjectPath(root: unknown, path: string): boolean {
  let current = root as Record<string, unknown> | undefined;

  for (const segment of path.split(".").filter(Boolean)) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return false;
    }
    current = current[segment] as Record<string, unknown> | undefined;
  }

  return true;
}

function validateEdge(
  edge: WorkflowEdge,
  index: number,
  nodes: Record<string, WorkflowNode>,
  issues: ProjectValidationIssue[]
): void {
  const path = `workflow.edges[${index}]`;
  const fromNode = nodes[edge.from?.nodeId];
  const toNode = nodes[edge.to?.nodeId];

  if (!fromNode) {
    issues.push({
      severity: "error",
      path: `${path}.from.nodeId`,
      message: `连线起点节点不存在：${edge.from?.nodeId}。`
    });
  } else if (!hasPort(fromNode.outputPorts, edge.from.port)) {
    issues.push({
      severity: "error",
      path: `${path}.from.port`,
      message: `连线起点端口不存在：${edge.from.port}。`
    });
  }

  if (!toNode) {
    issues.push({
      severity: "error",
      path: `${path}.to.nodeId`,
      message: `连线终点节点不存在：${edge.to?.nodeId}。`
    });
  } else if (!hasPort(toNode.inputPorts, edge.to.port)) {
    issues.push({
      severity: "error",
      path: `${path}.to.port`,
      message: `连线终点端口不存在：${edge.to.port}。`
    });
  }
}

function validateReachability(project: GameProject, issues: ProjectValidationIssue[]): void {
  const { workflow } = project;
  if (!workflow.nodes[workflow.startNodeId]) {
    return;
  }

  const visited = new Set<string>();
  const queue = [workflow.startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);

    workflow.edges
      .filter(edge => edge.from.nodeId === nodeId)
      .forEach(edge => {
        if (!visited.has(edge.to.nodeId)) {
          queue.push(edge.to.nodeId);
        }
      });
  }

  Object.keys(workflow.nodes)
    .filter(nodeId => !visited.has(nodeId))
    .forEach(nodeId => {
      issues.push({
        severity: "warning",
        path: `workflow.nodes.${nodeId}`,
        message: `节点 ${nodeId} 无法从 start 节点到达。`
      });
    });
}

function validateUniqueIds<T extends object>(
  collectionPath: string,
  values: T[] | undefined,
  key: keyof T,
  issues: ProjectValidationIssue[]
): void {
  if (!Array.isArray(values)) {
    return;
  }

  const seen = new Set<unknown>();
  values.forEach((value, index) => {
    const id = value[key];
    if (typeof id !== "string" || id.length === 0) {
      issues.push({
        severity: "error",
        path: `${collectionPath}[${index}].${String(key)}`,
        message: "ID 必须是非空字符串。"
      });
      return;
    }
    if (seen.has(id)) {
      issues.push({
        severity: "error",
        path: `${collectionPath}[${index}].${String(key)}`,
        message: `ID 重复：${id}。`
      });
    }
    seen.add(id);
  });
}

function result(issues: ProjectValidationIssue[]): ProjectValidationResult {
  const errors = issues.filter(issue => issue.severity === "error");
  const warnings = issues.filter(issue => issue.severity === "warning");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues
  };
}

function requireRecord(input: unknown, key: string, issues: ProjectValidationIssue[]): void {
  if (!isRecord(input) || !isRecord(input[key])) {
    issues.push({
      severity: "error",
      path: key,
      message: `${key} 必须是对象。`
    });
  }
}

function requireArray(input: unknown, key: string, path: string, issues: ProjectValidationIssue[]): void {
  if (!isRecord(input) || !Array.isArray(input[key])) {
    issues.push({
      severity: "error",
      path,
      message: `${path} 必须是数组。`
    });
  }
}

function requireString(input: unknown, key: string, path: string, issues: ProjectValidationIssue[]): void {
  if (!isRecord(input) || typeof input[key] !== "string" || input[key].length === 0) {
    issues.push({
      severity: "error",
      path,
      message: `${path} 必须是非空字符串。`
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasPort(ports: readonly string[], port: string): boolean {
  return ports.some(item => item === port);
}
