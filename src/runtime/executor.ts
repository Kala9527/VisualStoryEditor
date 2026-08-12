import { applyEffects } from "../domain/effects/applyEffect";
import { rollbackDiffs } from "../domain/effects/rollbackEffect";
import { evaluateCondition } from "../domain/expression/evaluator";
import { deepClone } from "../domain/expression/helpers";
import { indexById, type GameProject, type ID } from "../domain/types/project";
import type {
  CombatResult,
  ExecutorInput,
  ExecutorStepResult,
  RuntimeChoiceView,
  RuntimeContext,
  RuntimeLog,
} from "../domain/types/runtime";
import type {
  ChoiceNode,
  CombatNode,
  Condition,
  ConditionNode,
  Effect,
  RandomNode,
  WorkflowNode,
} from "../domain/types/workflow";
import { getNode, getOutgoingEdges, resolveNextEdge } from "./graphResolver";
import { createRandomSource, pickWeighted } from "./random";

export class WorkflowExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowExecutionError";
  }
}

export function createRuntimeContext(project: GameProject): RuntimeContext {
  const clonedProject = deepClone(project);
  const actorsById = indexById(clonedProject.actors);

  return {
    project: clonedProject,
    currentNodeId: clonedProject.workflow.startNodeId,
    state: deepClone(clonedProject.state),
    actorsById,
    itemsById: indexById(clonedProject.items),
    history: [],
  };
}

export function stepWorkflow(ctx: RuntimeContext, input: ExecutorInput = {}): ExecutorStepResult {
  const node = getNode(ctx.project.workflow, ctx.currentNodeId);

  try {
    switch (node.type) {
      case "start":
        return advance(ctx, node, "out");
      case "story":
        if (!input.continue) {
          return {
            status: "waiting",
            node,
            context: ctx,
            message: "Story node is waiting for continue input",
          };
        }
        return advance(ctx, node, "out");
      case "choice":
        return executeChoice(ctx, node, input.choiceId);
      case "condition":
        return executeCondition(ctx, node);
      case "random":
        return executeRandom(ctx, node);
      case "mutation":
        return advance(ctx, node, "out", node.effects);
      case "combat":
        return executeCombat(ctx, node, input.combatResult);
      case "end":
        return {
          status: "ended",
          node,
          context: ctx,
          message: node.endingTitle,
        };
      default:
        return assertNever(node);
    }
  } catch (error) {
    return {
      status: "error",
      node,
      context: ctx,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function runUntilWait(ctx: RuntimeContext, maxSteps = 100): ExecutorStepResult {
  let result = stepWorkflow(ctx, { continue: true });
  let steps = 1;

  while (result.status === "running" && steps < maxSteps) {
    result = stepWorkflow(ctx, { continue: true });
    steps += 1;
  }

  if (steps >= maxSteps && result.status === "running") {
    return {
      status: "error",
      node: result.node,
      context: ctx,
      message: `Execution exceeded maxSteps=${maxSteps}`,
      log: result.log,
    };
  }

  return result;
}

export function getAvailableChoices(ctx: RuntimeContext, node: ChoiceNode): RuntimeChoiceView[] {
  return node.choices.map((choice) => {
    const hiddenReasons = evaluateConditionList(choice.visibleWhen, ctx);
    const disabledReasons = evaluateConditionList(choice.enabledWhen, ctx);

    return {
      choice,
      visible: hiddenReasons.length === 0,
      enabled: disabledReasons.length === 0,
      hiddenReasons,
      disabledReasons,
    };
  });
}

function executeChoice(
  ctx: RuntimeContext,
  node: ChoiceNode,
  choiceId?: ID,
): ExecutorStepResult {
  const availableChoices = getAvailableChoices(ctx, node);

  if (!choiceId) {
    return {
      status: "waiting",
      node,
      context: ctx,
      availableChoices,
      message: "Choice node is waiting for choiceId input",
    };
  }

  const view = availableChoices.find((entry) => entry.choice.id === choiceId);
  if (!view || !view.visible || !view.enabled) {
    throw new WorkflowExecutionError(`Choice "${choiceId}" is not available`);
  }

  const port = `choice:${choiceId}`;

  if (getOutgoingEdges(ctx.project.workflow, node.id, port).length === 0 && view.choice.nextNodeId) {
    return advanceDirect(ctx, node, view.choice.nextNodeId, port, view.choice.effects, {
      selectedChoiceId: choiceId,
    });
  }

  return advance(ctx, node, port, view.choice.effects, {
    selectedChoiceId: choiceId,
  });
}

function executeCondition(ctx: RuntimeContext, node: ConditionNode): ExecutorStepResult {
  for (const branch of node.branches) {
    const result = evaluateCondition(branch.condition, ctx);
    if (result) {
      return advance(ctx, node, branch.port, [], {
        conditionResult: {
          expression: branch.condition.expression,
          result,
        },
      });
    }
  }

  return advance(ctx, node, node.fallbackPort, [], {
    conditionResult: {
      expression: "fallback",
      result: false,
    },
  });
}

function executeRandom(ctx: RuntimeContext, node: RandomNode): ExecutorStepResult {
  const seed = node.seedKey ? `${ctx.randomSeed ?? ""}:${node.id}:${node.seedKey}:${ctx.history.length}` : undefined;
  const { item, roll } = pickWeighted(node.branches, createRandomSource(seed));

  return advance(ctx, node, item.port, [], {
    randomResult: {
      port: item.port,
      seed,
      roll,
    },
  });
}

function executeCombat(
  ctx: RuntimeContext,
  node: CombatNode,
  combatResult?: CombatResult,
): ExecutorStepResult {
  if (!combatResult) {
    return {
      status: "waiting",
      node,
      context: ctx,
      message: "Combat node is waiting for combatResult input",
    };
  }

  const effects = getCombatEffects(node, combatResult);
  return advance(ctx, node, combatResult, effects, { combatResult });
}

function getCombatEffects(node: CombatNode, combatResult: CombatResult): Effect[] {
  if (combatResult === "win") {
    return node.winEffects ?? [];
  }
  if (combatResult === "lose" || combatResult === "dead") {
    return node.loseEffects ?? [];
  }
  if (combatResult === "escape") {
    if (!node.escapeAllowed) {
      throw new WorkflowExecutionError("Escape is not allowed for this combat node");
    }
    return node.escapeEffects ?? [];
  }
  return [];
}

function advance(
  ctx: RuntimeContext,
  node: WorkflowNode,
  outputPort: string,
  effects: Effect[] = [],
  logPatch: Partial<RuntimeLog> = {},
): ExecutorStepResult {
  const diffs = applyEffects(ctx, effects);
  const resolution = resolveNextEdge(ctx.project.workflow, node.id, outputPort, ctx);

  if (!resolution) {
    rollbackDiffs(ctx, diffs);
    throw new WorkflowExecutionError(`No valid edge from "${node.id}" output "${outputPort}"`);
  }

  ctx.currentNodeId = resolution.nextNode.id;

  const log = createRuntimeLog(ctx, node, outputPort, diffs, resolution.nextNode.id, logPatch);
  ctx.history.push(log);

  return {
    status: resolution.nextNode.type === "end" ? "ended" : "running",
    node: resolution.nextNode,
    context: ctx,
    log,
  };
}

function advanceDirect(
  ctx: RuntimeContext,
  node: WorkflowNode,
  nextNodeId: ID,
  outputPort: string,
  effects: Effect[] = [],
  logPatch: Partial<RuntimeLog> = {},
): ExecutorStepResult {
  const diffs = applyEffects(ctx, effects);
  const nextNode = getNode(ctx.project.workflow, nextNodeId);
  ctx.currentNodeId = nextNode.id;

  const log = createRuntimeLog(ctx, node, outputPort, diffs, nextNode.id, logPatch);
  ctx.history.push(log);

  return {
    status: nextNode.type === "end" ? "ended" : "running",
    node: nextNode,
    context: ctx,
    log,
  };
}

function evaluateConditionList(conditions: Condition[] = [], ctx: RuntimeContext): string[] {
  return conditions
    .map((condition) => ({
      condition,
      result: evaluateCondition(condition, ctx),
    }))
    .filter((entry) => !entry.result)
    .map((entry) => entry.condition.label ?? entry.condition.expression);
}

function createRuntimeLog(
  ctx: RuntimeContext,
  node: WorkflowNode,
  outputPort: string,
  diffs: RuntimeLog["diffs"],
  nextNodeId: ID | undefined,
  patch: Partial<RuntimeLog>,
): RuntimeLog {
  return {
    id: `log_${Date.now()}_${ctx.history.length + 1}`,
    nodeId: node.id,
    nodeType: node.type,
    outputPort,
    diffs,
    nextNodeId,
    createdAt: new Date().toISOString(),
    ...patch,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled workflow node: ${JSON.stringify(value)}`);
}
