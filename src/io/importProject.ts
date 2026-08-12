import type { GameProject } from "../domain/types";
import { importProjectJson as importProjectJsonWithValidation } from "./projectJson";

export function importProjectJson(json: string): GameProject {
  return importProjectJsonWithValidation(json).project;
}
