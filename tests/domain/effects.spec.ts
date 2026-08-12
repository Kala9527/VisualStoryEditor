import { describe, expect, it } from "vitest";
import { applyEffect } from "../../src/domain/effects/applyEffect";
import { rollbackDiffs } from "../../src/domain/effects/rollbackEffect";
import { createRuntimeContext } from "../fixtures/sampleProject";

describe("domain/effects contract", () => {
  it("applies numeric player mutations and returns reversible diffs", () => {
    const ctx = createRuntimeContext();

    const diff = applyEffect(ctx, {
      id: "effect_damage",
      target: { scope: "player", path: "attributes.hp" },
      op: "dec",
      value: 10,
      reason: "Fog damage"
    });

    expect(ctx.actorsById.player.attributes.hp).toBe(70);
    expect(diff).toMatchObject({
      path: "player.attributes.hp",
      before: 80,
      after: 70
    });

    rollbackDiffs(ctx, [diff]);
    expect(ctx.actorsById.player.attributes.hp).toBe(80);
  });

  it("sets global flags and increments NPC relationship values", () => {
    const ctx = createRuntimeContext();

    applyEffect(ctx, {
      id: "effect_met_elena",
      target: { scope: "global", path: "flags.met_elena" },
      op: "set",
      value: true
    });
    applyEffect(ctx, {
      id: "effect_relation_up",
      target: { scope: "npc", actorId: "npc_elena", path: "relations.player" },
      op: "inc",
      value: 5
    });

    expect(ctx.state.global.flags.met_elena).toBe(true);
    expect(ctx.actorsById.npc_elena.relations?.player).toBe(10);
  });

  it("supports inventory append and remove semantics", () => {
    const ctx = createRuntimeContext();

    applyEffect(ctx, {
      id: "effect_gain_key",
      target: { scope: "player", path: "inventory" },
      op: "append",
      value: { itemId: "item_silver_key", count: 1 }
    });

    expect(ctx.actorsById.player.inventory).toContainEqual({ itemId: "item_silver_key", count: 1 });

    applyEffect(ctx, {
      id: "effect_remove_key",
      target: { scope: "player", path: "inventory" },
      op: "remove",
      value: "item_silver_key"
    });

    expect(ctx.actorsById.player.inventory.some((entry) => entry.itemId === "item_silver_key")).toBe(false);
  });

  it("rejects mutations to attributes that have not appeared in initial state", () => {
    const ctx = createRuntimeContext();

    expect(() =>
      applyEffect(ctx, {
        id: "effect_unknown_attr",
        target: { scope: "player", path: "attributes.luck" },
        op: "inc",
        value: 1
      })
    ).toThrow(/has not appeared before/);
    expect(ctx.actorsById.player.attributes).not.toHaveProperty("luck");
  });
});
