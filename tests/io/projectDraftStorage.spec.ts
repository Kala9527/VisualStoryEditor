import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "../../src/data/blankProject";
import {
  clearProjectDraft,
  loadProjectDraft,
  saveProjectDraft
} from "../../src/io/projectDraftStorage";
import { validateProjectBasic } from "../../src/io/validation";

describe("io/projectDraftStorage contract", () => {
  afterEach(() => {
    clearProjectDraft();
    vi.unstubAllGlobals();
  });

  it("creates a valid blank project for new story workflows", () => {
    const project = createBlankProject({ title: "Test Story" });
    const validation = validateProjectBasic(project);

    expect(validation.valid).toBe(true);
    expect(project.meta.title).toBe("Test Story");
    expect(project.workflow.startNodeId).toBe("n_start");
    expect(project.workflow.nodes.n_story_opening.type).toBe("story");
  });

  it("saves and loads the current project draft from localStorage", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    });

    const project = createBlankProject({ title: "Saved Draft" });
    const saved = saveProjectDraft(project);
    const loaded = loadProjectDraft();

    expect(saved?.savedAt).toBeTruthy();
    expect(loaded.ok).toBe(true);
    expect(loaded.ok && loaded.draft.project.meta.title).toBe("Saved Draft");
  });
});
