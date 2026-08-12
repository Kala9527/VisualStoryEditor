import type { GameProject } from "../domain/types";
import {
  exportProjectJson,
  importProjectJson as importProjectJsonWithValidation,
  type ExportProjectJsonOptions
} from "./projectJson";
import type { ProjectValidationResult } from "./validation";

export type ImportProjectFileResult =
  | {
      ok: true;
      project: GameProject;
      validation: ProjectValidationResult;
      errors: string[];
    }
  | {
      ok: false;
      project: null;
      validation?: ProjectValidationResult;
      errors: string[];
    };

export { exportProjectJson, type ExportProjectJsonOptions };

export function importProjectJson(json: string): ImportProjectFileResult {
  try {
    const result = importProjectJsonWithValidation(json);
    return {
      ok: true,
      project: result.project,
      validation: result.validation,
      errors: []
    };
  } catch (error) {
    return {
      ok: false,
      project: null,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}
