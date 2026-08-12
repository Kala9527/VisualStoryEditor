import type { Actor } from "./actor";
import type { Item } from "./item";
import type { WorkflowGraph } from "./workflow";

export type ID = string;

export type AttributeValue = number | string | boolean;

export type AttributeType = "number" | "string" | "boolean" | "enum";

export type EntityScope = "global" | "player" | "npc";

export interface AttributeDef {
  key: string;
  label: string;
  type: AttributeType;
  description?: string;
  min?: number;
  max?: number;
  enumValues?: string[];
  defaultValue?: AttributeValue;
}

export interface LocationDef {
  id: ID;
  name: string;
  summary: string;
  tags?: string[];
  parentLocationId?: ID;
}

export interface FactionDef {
  id: ID;
  name: string;
  summary: string;
  alignment?: string;
  relations?: Record<ID, number>;
}

export interface LoreEntry {
  id: ID;
  title: string;
  content: string;
}

export interface WorldDef {
  premise: string;
  tone: string;
  genre?: string;
  themes?: string[];
  locations: LocationDef[];
  factions: FactionDef[];
  loreEntries?: LoreEntry[];
}

export interface WorldState {
  variables: Record<string, AttributeValue>;
  flags: Record<string, boolean>;
  discoveredLocations: ID[];
  completedQuests?: ID[];
}

export interface ProjectState {
  playerId: ID;
  global: WorldState;
}

export interface ProjectMeta {
  title: string;
  author?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GameProject {
  schemaVersion: "1.0";
  meta: ProjectMeta;
  world: WorldDef;
  attributeDefs: AttributeDef[];
  items: Item[];
  actors: Actor[];
  state: ProjectState;
  workflow: WorkflowGraph;
}

export function indexById<T extends { id: ID }>(records: T[]): Record<ID, T> {
  return Object.fromEntries(records.map((record) => [record.id, record]));
}
