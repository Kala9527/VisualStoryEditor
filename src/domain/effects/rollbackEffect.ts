import type { RuntimeContext, StateDiff } from "../types/runtime";
import { setByPath } from "../expression/helpers";

export function rollbackDiffs(ctx: RuntimeContext, diffs: StateDiff[]): void {
  for (const diff of [...diffs].reverse()) {
    setRuntimePath(ctx, diff.path, diff.before);
  }
}

export function rollbackEffect(ctx: RuntimeContext, diff: StateDiff): void {
  setRuntimePath(ctx, diff.path, diff.before);
}

export function applyDiffs(ctx: RuntimeContext, diffs: StateDiff[]): void {
  for (const diff of diffs) {
    setRuntimePath(ctx, diff.path, diff.after);
  }
}

function setRuntimePath(ctx: RuntimeContext, path: string, value: unknown): void {
  const segments = path.split(".").filter(Boolean);
  const [scope, second, ...rest] = segments;

  if (scope === "global") {
    setByPath(ctx.state.global, [second, ...rest], value);
    return;
  }

  if (scope === "player") {
    if (second && ctx.actorsById[second]) {
      setByPath(ctx.actorsById[second], rest, value);
      return;
    }
    setByPath(ctx.actorsById[ctx.state.playerId], [second, ...rest], value);
    return;
  }

  if (scope === "npc") {
    setByPath(ctx.actorsById[second], rest, value);
    return;
  }

  throw new Error(`Unsupported runtime diff path: ${path}`);
}
