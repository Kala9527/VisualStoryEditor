import type { AttributeValue, ID } from "./project";

export type ItemType =
  | "weapon"
  | "armor"
  | "consumable"
  | "quest"
  | "material"
  | "misc";

export interface Item {
  id: ID;
  name: string;
  type: ItemType;
  description?: string;
  stackable?: boolean;
  maxStack?: number;
  attributes?: Record<string, AttributeValue>;
  tags?: string[];
}

export interface InventoryEntry {
  itemId: ID;
  count: number;
  equipped?: boolean;
}
