import type { GameProject } from "../domain/types";
import { validateProjectBasic, type ProjectValidationResult } from "./validation";

export interface ImportProjectResult {
  project: GameProject;
  validation: ProjectValidationResult;
}

export interface ExportProjectJsonOptions {
  pretty?: boolean;
  updateTimestamp?: boolean;
}

export function exportProjectJson(project: GameProject, options: ExportProjectJsonOptions = {}): string {
  const pretty = options.pretty ?? true;
  const sanitizedProject = sanitizeProjectForExport(project);
  const payload = options.updateTimestamp
    ? {
        ...sanitizedProject,
        meta: {
          ...sanitizedProject.meta,
          updatedAt: new Date().toISOString()
        }
      }
    : sanitizedProject;

  return JSON.stringify(payload, null, pretty ? 2 : 0);
}

export function importProjectJson(json: string): ImportProjectResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`项目 JSON 解析失败：${error instanceof Error ? error.message : String(error)}`);
  }

  const validation = validateProjectBasic(parsed);
  if (!validation.valid) {
    const message = validation.errors.map(issue => `${issue.path}: ${issue.message}`).join("\n");
    throw new Error(`项目文件未通过基础校验：\n${message}`);
  }

  return {
    project: parsed as GameProject,
    validation
  };
}

function sanitizeProjectForExport(project: GameProject): GameProject {
  const payload = JSON.parse(JSON.stringify(project)) as GameProject;

  Object.values(payload.workflow.nodes).forEach((node) => {
    delete (node as { aiSummary?: unknown }).aiSummary;
    delete (node as { designNotes?: unknown }).designNotes;

    if (node.type === "choice") {
      node.choices.forEach((choice) => {
        delete (choice as { aiIntent?: unknown }).aiIntent;
      });
    }
  });

  return payload;
}
