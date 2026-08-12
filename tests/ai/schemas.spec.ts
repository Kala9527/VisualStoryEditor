import { describe, expect, it } from "vitest";
import { validateGenerateBranchesOutput } from "../../src/ai/schemas";

describe("ai structured schema validation contract", () => {
  it("accepts valid branch-generation payloads as reviewable drafts", () => {
    const payload = {
      nodes: [
        {
          id: "n_story_follow_elena",
          type: "story",
          title: "Follow Elena",
          position: { x: 900, y: 0 },
          inputPorts: ["in"],
          outputPorts: ["out"],
          content: "Elena leads you through the fog toward a shuttered watch post."
        }
      ],
      edges: [
        {
          id: "e_help_follow_elena",
          from: { nodeId: "n_choice_first", port: "choice:ask_help" },
          to: { nodeId: "n_story_follow_elena", port: "in" }
        }
      ],
      summary: "Adds a social follow-up branch after asking Elena for help.",
      integrationNotes: ["Review overlap with existing e_choice_help_end before accepting."]
    };

    expect(validateGenerateBranchesOutput(payload, ["n_choice_first"])).toEqual([]);
  });

  it("rejects duplicate generated IDs and duplicate existing IDs", () => {
    const payload = {
      nodes: [
        {
          id: "n_story_wake",
          type: "story",
          title: "Duplicate Existing",
          inputPorts: ["in"],
          outputPorts: ["out"]
        },
        {
          id: "n_story_duplicate",
          type: "story",
          title: "Duplicate A",
          inputPorts: ["in"],
          outputPorts: ["out"]
        },
        {
          id: "n_story_duplicate",
          type: "story",
          title: "Duplicate B",
          inputPorts: ["in"],
          outputPorts: ["out"]
        }
      ],
      edges: [],
      summary: "Invalid branch.",
      integrationNotes: []
    };

    const errors = validateGenerateBranchesOutput(payload, ["n_story_wake"]);

    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("n_story_wake")]));
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("n_story_duplicate")]));
  });

  it("keeps malformed AI branch payloads out of the project merge path", () => {
    const errors = validateGenerateBranchesOutput({
      nodes: "not-an-array",
      edges: [
        {
          id: "e_missing_shape",
          from: "missing-node",
          to: { nodeId: "n_end_safe", port: "in" }
        }
      ],
      summary: "",
      integrationNotes: "not-an-array"
    });

    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("nodes")]));
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("summary")]));
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("integrationNotes")]));
  });
});
