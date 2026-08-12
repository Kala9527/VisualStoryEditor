import type { Actor } from "../types/actor";
import type { Condition } from "../types/workflow";
import type { RuntimeContext } from "../types/runtime";
import { getByPath, getInventoryEntry, getNpc, getPlayer, toBoolean } from "./helpers";
import { parseExpression, type BinaryNode, type ExpressionNode } from "./parser";

type RuntimeValue = string | number | boolean | null | undefined | Actor | Record<string, unknown>;

export class ExpressionEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionEvaluationError";
  }
}

export function evaluateCondition(condition: Condition, ctx: RuntimeContext): boolean {
  return evaluateExpression(condition.expression, ctx);
}

export function evaluateExpression(expression: string, ctx: RuntimeContext): boolean {
  const ast = parseExpression(expression);
  return toBoolean(evaluateNode(ast, ctx));
}

export function evaluateValue(expression: string, ctx: RuntimeContext): unknown {
  return evaluateNode(parseExpression(expression), ctx);
}

function evaluateNode(node: ExpressionNode, ctx: RuntimeContext): RuntimeValue {
  switch (node.type) {
    case "literal":
      return node.value;
    case "identifier":
      return resolveIdentifier(node.path, ctx);
    case "unary":
      return !toBoolean(evaluateNode(node.argument, ctx));
    case "binary":
      return evaluateBinary(node, ctx);
    case "call":
      return evaluateCall(node.name, node.args.map((arg) => evaluateNode(arg, ctx)), ctx);
    default:
      return assertNever(node);
  }
}

function resolveIdentifier(path: string[], ctx: RuntimeContext): RuntimeValue {
  const [scope, second, ...rest] = path;

  if (scope === "player") {
    const player = getPlayer(ctx);
    return getByPath(player, [second, ...rest]) as RuntimeValue;
  }

  if (scope === "global") {
    return getByPath(ctx.state.global, [second, ...rest]) as RuntimeValue;
  }

  if (scope === "npc") {
    const npc = getNpc(ctx, second);
    return getByPath(npc, rest) as RuntimeValue;
  }

  throw new ExpressionEvaluationError(`Unsupported identifier root "${scope}"`);
}

function evaluateBinary(node: BinaryNode, ctx: RuntimeContext): boolean {
  if (node.operator === "&&") {
    return toBoolean(evaluateNode(node.left, ctx)) && toBoolean(evaluateNode(node.right, ctx));
  }
  if (node.operator === "||") {
    return toBoolean(evaluateNode(node.left, ctx)) || toBoolean(evaluateNode(node.right, ctx));
  }

  const left = evaluateNode(node.left, ctx);
  const right = evaluateNode(node.right, ctx);

  switch (node.operator) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case ">":
      return compare(left, right) > 0;
    case ">=":
      return compare(left, right) >= 0;
    case "<":
      return compare(left, right) < 0;
    case "<=":
      return compare(left, right) <= 0;
    default:
      return assertNever(node.operator);
  }
}

function compare(left: RuntimeValue, right: RuntimeValue): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right);
  }
  throw new ExpressionEvaluationError("Comparison requires both values to be numbers or both strings");
}

function evaluateCall(name: string, args: RuntimeValue[], ctx: RuntimeContext): RuntimeValue {
  switch (name) {
    case "hasItem":
      return itemCount(ctx, expectString(args[0], "hasItem itemId")) > 0;
    case "itemCount":
      return itemCount(ctx, expectString(args[0], "itemCount itemId"));
    case "hasFlag":
      return hasFlag(ctx, expectString(args[0], "hasFlag flagKey"), optionalString(args[1]));
    case "relation":
      return relation(ctx, expectString(args[0], "relation npcId"), optionalString(args[1]));
    case "attr":
      return attr(ctx, expectString(args[0], "attr entity"), expectString(args[1], "attr key"));
    default:
      throw new ExpressionEvaluationError(`Unsupported function "${name}"`);
  }
}

function itemCount(ctx: RuntimeContext, itemId: string): number {
  return getInventoryEntry(ctx, itemId)?.count ?? 0;
}

function hasFlag(ctx: RuntimeContext, flagKey: string, actorId?: string): boolean {
  if (!actorId || actorId === "global") {
    return ctx.state.global.flags[flagKey] === true;
  }
  if (actorId === "player") {
    return getPlayer(ctx)?.flags[flagKey] === true;
  }
  return getNpc(ctx, actorId)?.flags[flagKey] === true;
}

function relation(ctx: RuntimeContext, npcId: string, targetId = ctx.state.playerId): number {
  return Number(getNpc(ctx, npcId)?.relations?.[targetId] ?? 0);
}

function attr(ctx: RuntimeContext, entity: string, key: string): RuntimeValue {
  if (entity === "player") {
    return getPlayer(ctx)?.attributes[key] as RuntimeValue;
  }
  if (entity === "global") {
    return ctx.state.global.variables[key];
  }
  return getNpc(ctx, entity)?.attributes[key] as RuntimeValue;
}

function expectString(value: RuntimeValue, label: string): string {
  if (typeof value !== "string") {
    throw new ExpressionEvaluationError(`${label} must be a string`);
  }
  return value;
}

function optionalString(value: RuntimeValue): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return expectString(value, "optional argument");
}

function assertNever(value: never): never {
  throw new Error(`Unhandled expression node: ${JSON.stringify(value)}`);
}
