import type { StateDiff } from "../types/runtime";
import { deepClone } from "../expression/helpers";

export function createStateDiff(path: string, before: unknown, after: unknown): StateDiff {
  return {
    path,
    before: deepClone(before),
    after: deepClone(after),
  };
}

export function hasStateChanged(diff: StateDiff): boolean {
  return JSON.stringify(diff.before) !== JSON.stringify(diff.after);
}

export function filterChangedDiffs(diffs: StateDiff[]): StateDiff[] {
  return diffs.filter(hasStateChanged);
}
