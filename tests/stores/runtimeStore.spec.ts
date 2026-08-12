import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createSampleProject } from "../../src/data/sampleProject";
import { useProjectStore } from "../../src/stores/projectStore";
import { useRuntimeStore } from "../../src/stores/runtimeStore";

describe("stores/runtimeStore combat flow", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("waits for an explicit combat result and advances through the lose port", () => {
    const project = createSampleProject();
    const projectStore = useProjectStore();
    const runtimeStore = useRuntimeStore();

    projectStore.loadProject(project);
    runtimeStore.start(project);
    runtimeStore.continueStory();
    runtimeStore.choose("force_escape");

    expect(runtimeStore.status).toBe("waiting_combat");
    expect(runtimeStore.currentNodeId).toBe("n_combat_hound");
    expect(runtimeStore.lastNarration).toContain("enemy_fog_hound");
    expect(runtimeStore.actorSnapshots.find((actor) => actor.id === "player")?.attributes.hp).toBe(68);

    runtimeStore.resolveCombat("lose");

    const combatLog = runtimeStore.history.find((log) => log.nodeId === "n_combat_hound");
    expect(runtimeStore.status).toBe("ended");
    expect(runtimeStore.ending?.endingId).toBe("ending_fog_defeat");
    expect(runtimeStore.actorSnapshots.find((actor) => actor.id === "player")?.attributes.hp).toBe(48);
    expect(combatLog?.combatResult).toBe("lose");
    expect(combatLog?.outputPort).toBe("lose");
    expect(combatLog?.nextNodeId).toBe("n_end_fog_defeat");
  });
});
