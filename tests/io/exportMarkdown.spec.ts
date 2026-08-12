import { describe, expect, it } from "vitest";
import { exportMarkdown } from "../../src/io/exportMarkdown";
import { createSampleProject } from "../fixtures/sampleProject";

describe("io/exportMarkdown contract", () => {
  it("exports a planner-readable mark.md document with traceable IDs", () => {
    const markdown = exportMarkdown(createSampleProject(), {
      includeAiNotes: true,
      includeJsonBlocks: false
    });

    expect(markdown).toContain("# Fog Harbor");
    expect(markdown).toContain("Fog Harbor");
    expect(markdown).toContain("### player Player");
    expect(markdown).toContain("### n_story_wake Wake Up");
    expect(markdown).toContain("out -> n_choice_first");
    expect(markdown).toContain("effect_met_elena");
  });

  it("does not infinitely expand cyclic graphs", () => {
    const project = createSampleProject();
    project.workflow.edges.push({
      id: "e_cycle",
      from: { nodeId: "n_end_safe", port: "restart" },
      to: { nodeId: "n_story_wake", port: "in" }
    });

    const markdown = exportMarkdown(project, { includeAiNotes: false, includeJsonBlocks: false });

    expect(markdown.match(/### n_story_wake/g)).toHaveLength(2);
    expect(markdown).toContain("restart -> n_story_wake");
  });
});
