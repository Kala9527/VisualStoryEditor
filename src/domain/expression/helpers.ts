import type { Actor } from "../types/actor";
import type { InventoryEntry } from "../types/item";
import type { RuntimeContext } from "../types/runtime";

export function getPlayer(ctx: RuntimeContext): Actor | undefined {
  return ctx.actorsById[ctx.state.playerId] ?? ctx.actorsById[ctx.project.state.playerId];
}

export function getNpc(ctx: RuntimeContext, actorId: string): Actor | undefined {
  const actor = ctx.actorsById[actorId];
  if (!actor || actor.role === "player") {
    return undefined;
  }
  return actor;
}

export function getInventoryEntry(ctx: RuntimeContext, itemId: string): InventoryEntry | undefined {
  const player = getPlayer(ctx);
  return player?.inventory.find((entry) => entry.itemId === itemId);
}

export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  return Boolean(value);
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getByPath(root: unknown, path: string | string[]): unknown {
  const segments = Array.isArray(path) ? path : normalizePath(path);
  let current = root as Record<string, unknown> | undefined;

  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = current[segment] as Record<string, unknown> | undefined;
  }

  return current;
}

export function hasPath(root: unknown, path: string | string[]): boolean {
  const segments = Array.isArray(path) ? path : normalizePath(path);
  let current = root as Record<string, unknown> | undefined;

  for (const segment of segments) {
    if (current == null || typeof current !== "object" || !(segment in current)) {
      return false;
    }
    current = current[segment] as Record<string, unknown> | undefined;
  }

  return true;
}

export function setByPath(root: unknown, path: string | string[], value: unknown): void {
  const segments = Array.isArray(path) ? path : normalizePath(path);
  if (segments.length === 0) {
    throw new Error("Cannot set an empty path");
  }

  let current = root as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (next == null || typeof next !== "object" || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
}

export function normalizePath(path: string): string[] {
  return path.split(".").map((segment) => segment.trim()).filter(Boolean);
}
