import { describe, expect, it } from "vitest";
import { exportProjectJson, importProjectJson } from "../../src/io/projectJson";
import { createSampleProject } from "../fixtures/sampleProject";

describe("io project import/export contract", () => {
  it("round-trips a valid .rpgstory.json payload", () => {
    const project = createSampleProject();
    const serialized = exportProjectJson(project);
    const { project: imported, validation } = importProjectJson(serialized);

    expect(validation.valid).toBe(true);
    expect(imported.schemaVersion).toBe("1.0");
    expect(imported.meta.title).toBe(project.meta.title);
    expect(imported.workflow.startNodeId).toBe("n_start");
    expect(Object.keys(imported.workflow.nodes)).toEqual(Object.keys(project.workflow.nodes));
  });

  it("rejects malformed JSON with a readable validation error", () => {
    expect(() => importProjectJson("{bad json")).toThrow(/json|parse/i);
  });

  it("rejects duplicate or missing references before loading into Pinia", () => {
    const project = createSampleProject();
    project.state.playerId = "missing_player";

    expect(() => importProjectJson(JSON.stringify(project))).toThrow(/playerId|missing_player/i);
  });
});
