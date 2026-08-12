import { describe, expect, it } from "vitest";
import { resolveNextNodeId } from "../../src/runtime/graphResolver";
import { validateProjectBasic } from "../../src/io/validation";
import { createRuntimeContext, createSampleProject } from "../fixtures/sampleProject";

describe("runtime/graphResolver contract", () => {
  it("resolves the next node by output port", () => {
    const project = createSampleProject();
    const ctx = createRuntimeContext(project);

    expect(resolveNextNodeId(project.workflow, "n_start", "out", ctx)).toBe("n_story_wake");
    expect(resolveNextNodeId(project.workflow, "n_story_wake", "out", ctx)).toBe("n_choice_first");
  });

  it("skips guarded edges when the guard condition is false", () => {
    const project = createSampleProject();
    project.workflow.edges.push({
      id: "e_guarded",
      from: { nodeId: "n_choice_first", port: "choice:hide_key" },
      to: { nodeId: "n_end_safe", port: "in" },
      guard: { id: "guard_hp", expression: "player.attributes.hp < 10" }
    });

    expect(resolveNextNodeId(project.workflow, "n_choice_first", "choice:hide_key", createRuntimeContext(project))).toBeNull();
  });

  it("reports invalid edge ports and unreachable nodes during project validation", () => {
    const project = createSampleProject();
    project.workflow.nodes.n_orphan = {
      id: "n_orphan",
      type: "story",
      title: "Orphan",
      position: { x: 0, y: 240 },
      inputPorts: ["in"],
      outputPorts: ["out"],
      content: "This node is not reachable."
    };
    project.workflow.edges.push({
      id: "e_bad_port",
      from: { nodeId: "n_story_wake", port: "missing" },
      to: { nodeId: "n_end_safe", port: "in" }
    });

    const result = validateProjectBasic(project);

    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => `${issue.path} ${issue.message}`)).toEqual(
      expect.arrayContaining([expect.stringContaining("missing")])
    );
    expect(result.warnings.map((issue) => `${issue.path} ${issue.message}`)).toEqual(
      expect.arrayContaining([expect.stringContaining("n_orphan")])
    );
  });
});
