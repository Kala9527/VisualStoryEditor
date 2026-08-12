import { describe, expect, it } from "vitest";
import { evaluateCondition } from "../../src/domain/expression/evaluator";
import { createRuntimeContext } from "../fixtures/sampleProject";

describe("domain/expression/evaluator contract", () => {
  it("evaluates attribute and global flag expressions without eval", () => {
    const ctx = createRuntimeContext();

    expect(evaluateCondition({ id: "c_hp", expression: "player.attributes.hp >= 80" }, ctx)).toBe(true);
    expect(evaluateCondition({ id: "c_fog", expression: "global.variables.fogLevel < 3" }, ctx)).toBe(false);
    expect(evaluateCondition({ id: "c_flag", expression: "player.flags.hasMap == true" }, ctx)).toBe(true);
  });

  it("supports item and relation helper functions used by story branches", () => {
    const ctx = createRuntimeContext();

    expect(evaluateCondition({ id: "c_items", expression: "itemCount(\"item_potion\") >= 2" }, ctx)).toBe(true);
    expect(evaluateCondition({ id: "c_has_item", expression: "hasItem(\"item_silver_key\")" }, ctx)).toBe(false);
    expect(evaluateCondition({ id: "c_relation", expression: "relation(\"npc_elena\") >= 5" }, ctx)).toBe(true);
  });

  it("rejects unsafe JavaScript and unknown helpers", () => {
    const ctx = createRuntimeContext();

    expect(() =>
      evaluateCondition({ id: "c_unsafe", expression: "globalThis.localStorage.clear()" }, ctx)
    ).toThrow();
    expect(() =>
      evaluateCondition({ id: "c_unknown", expression: "deleteProject(\"all\") == true" }, ctx)
    ).toThrow();
  });
});
