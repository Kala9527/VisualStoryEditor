import type { Actor } from "../types/actor";
import type { InventoryEntry } from "../types/item";
import type { RuntimeContext, StateDiff } from "../types/runtime";
import type { Effect, EffectTarget } from "../types/workflow";
import { deepClone, getByPath, getPlayer, hasPath, setByPath } from "../expression/helpers";

export class EffectApplicationError extends Error {
  constructor(message: string, public readonly effect?: Effect) {
    super(message);
    this.name = "EffectApplicationError";
  }
}

export function applyEffect(ctx: RuntimeContext, effect: Effect): StateDiff {
  const root = resolveEffectRoot(ctx, effect.target, effect);
  if (!hasPath(root, effect.target.path)) {
    throw new EffectApplicationError(`Effect target path "${effect.target.path}" has not appeared before`, effect);
  }
  const before = deepClone(getByPath(root, effect.target.path));
  const after = calculateNextValue(before, effect);

  setByPath(root, effect.target.path, after);

  return {
    path: formatEffectPath(ctx, effect.target),
    before,
    after: deepClone(after),
    effectId: effect.id,
    reason: effect.reason,
  };
}

export function applyEffects(ctx: RuntimeContext, effects: Effect[] = []): StateDiff[] {
  return effects.map((effect) => applyEffect(ctx, effect));
}

function resolveEffectRoot(ctx: RuntimeContext, target: EffectTarget, effect: Effect): object {
  if (target.scope === "global") {
    return ctx.state.global;
  }

  if (target.scope === "player") {
    const player = getPlayer(ctx);
    if (!player) {
      throw new EffectApplicationError("Player actor was not found", effect);
    }
    return player;
  }

  if (target.scope === "npc") {
    if (!target.actorId) {
      throw new EffectApplicationError("NPC effect target requires actorId", effect);
    }
    const actor = ctx.actorsById[target.actorId];
    if (!actor) {
      throw new EffectApplicationError(`NPC actor "${target.actorId}" was not found`, effect);
    }
    return actor;
  }

  throw new EffectApplicationError(`Unsupported effect scope "${target.scope}"`, effect);
}

function calculateNextValue(before: unknown, effect: Effect): unknown {
  switch (effect.op) {
    case "set":
      return deepClone(effect.value);
    case "inc":
      return requireNumber(before, effect) + requireNumber(effect.value, effect);
    case "dec":
      return requireNumber(before, effect) - requireNumber(effect.value, effect);
    case "toggle":
      return !Boolean(before);
    case "append":
      return appendValue(before, effect.value);
    case "remove":
      return removeValue(before, effect.value, effect);
    default:
      return assertNever(effect.op);
  }
}

function appendValue(before: unknown, value: unknown): unknown[] {
  const array = Array.isArray(before) ? deepClone(before) : [];

  if (isInventoryEntry(value)) {
    return appendInventoryEntry(array, value);
  }

  return [...array, deepClone(value)];
}

function removeValue(before: unknown, value: unknown, effect: Effect): unknown[] {
  if (!Array.isArray(before)) {
    throw new EffectApplicationError("remove operation requires an array target", effect);
  }

  const array = deepClone(before);

  if (typeof value === "string" && looksLikeInventory(array)) {
    return removeInventoryItem(array, value);
  }

  if (isInventoryEntry(value)) {
    return removeInventoryItem(array, value.itemId, value.count);
  }

  return array.filter((entry) => entry !== value);
}

function appendInventoryEntry(array: unknown[], value: InventoryEntry): InventoryEntry[] {
  const entries = array.filter(isInventoryEntry).map((entry) => ({ ...entry }));
  const existing = entries.find((entry) => entry.itemId === value.itemId && entry.equipped === value.equipped);

  if (existing) {
    existing.count += value.count;
    return entries;
  }

  return [...entries, { ...value }];
}

function removeInventoryItem(array: unknown[], itemId: string, count = Number.POSITIVE_INFINITY): InventoryEntry[] {
  const entries = array.filter(isInventoryEntry).map((entry) => ({ ...entry }));
  const existing = entries.find((entry) => entry.itemId === itemId);

  if (!existing) {
    return entries;
  }

  existing.count -= count;
  return entries.filter((entry) => entry.count > 0);
}

function looksLikeInventory(array: unknown[]): boolean {
  return array.length === 0 || array.every(isInventoryEntry);
}

function isInventoryEntry(value: unknown): value is InventoryEntry {
  return (
    value != null &&
    typeof value === "object" &&
    typeof (value as InventoryEntry).itemId === "string" &&
    typeof (value as InventoryEntry).count === "number"
  );
}

function requireNumber(value: unknown, effect: Effect): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new EffectApplicationError(`${effect.op} operation requires numeric values`, effect);
  }
  return value;
}

function formatEffectPath(ctx: RuntimeContext, target: EffectTarget): string {
  if (target.scope === "global") {
    return `global.${target.path}`;
  }
  if (target.scope === "player") {
    return `player.${target.path}`;
  }
  return `npc.${target.actorId ?? "unknown"}.${target.path}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled effect operation: ${String(value)}`);
}

export function getEffectActor(ctx: RuntimeContext, actorId: string): Actor | undefined {
  return ctx.actorsById[actorId];
}
