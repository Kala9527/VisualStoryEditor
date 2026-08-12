import type { AttributeValue, ID } from "./project";
import type { InventoryEntry } from "./item";

export type ActorRole = "player" | "companion" | "npc" | "enemy";

export interface Actor {
  id: ID;
  name: string;
  role: ActorRole;
  summary: string;
  biography?: string;
  factionId?: ID;
  locationId?: ID;
  attributes: Record<string, AttributeValue>;
  inventory: InventoryEntry[];
  flags: Record<string, boolean>;
  relations?: Record<ID, number>;
  tags?: string[];
  aiNotes?: string;
}
