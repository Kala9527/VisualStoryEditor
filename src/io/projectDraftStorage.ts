import type { GameProject } from "../domain/types";
import { exportProjectJson, importProjectJson } from "./projectFile";

const draftStorageKey = "visual-story-editor:project-draft";

export interface ProjectDraftInfo {
  project: GameProject;
  savedAt: string;
}

export type ProjectDraftLoadResult =
  | {
      ok: true;
      draft: ProjectDraftInfo;
      error?: never;
    }
  | {
      ok: false;
      draft: null;
      error: string;
    };

export function saveProjectDraft(project: GameProject): ProjectDraftInfo | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const savedAt = new Date().toISOString();
  const payload = {
    savedAt,
    projectJson: exportProjectJson(project, {
      pretty: false,
      updateTimestamp: true
    })
  };

  localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  return {
    project,
    savedAt
  };
}

export function loadProjectDraft(): ProjectDraftLoadResult {
  if (typeof localStorage === "undefined") {
    return {
      ok: false,
      draft: null,
      error: "当前环境不支持本地保存。"
    };
  }

  const raw = localStorage.getItem(draftStorageKey);
  if (!raw) {
    return {
      ok: false,
      draft: null,
      error: "没有本地草稿。"
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<{
      savedAt: string;
      projectJson: string;
    }>;

    if (!parsed.projectJson) {
      throw new Error("草稿内容为空。");
    }

    const result = importProjectJson(parsed.projectJson);
    if (!result.ok) {
      throw new Error(result.errors.join("\n"));
    }

    return {
      ok: true,
      draft: {
        project: result.project,
        savedAt: parsed.savedAt ?? new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      ok: false,
      draft: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function clearProjectDraft(): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.removeItem(draftStorageKey);
}
