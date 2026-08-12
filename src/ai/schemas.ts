export type ID = string;

export type AttributeValue = number | string | boolean;

export type AttributeType = "number" | "string" | "boolean" | "enum";

export type ActorRole = "player" | "companion" | "npc" | "enemy";

export type ItemType =
  | "weapon"
  | "armor"
  | "consumable"
  | "quest"
  | "material"
  | "misc";

export type EntityScope = "global" | "player" | "npc";

export type EffectOperation =
  | "set"
  | "inc"
  | "dec"
  | "append"
  | "remove"
  | "toggle";

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

export interface WorldDef {
  premise: string;
  tone: string;
  genre?: string;
  themes?: string[];
  locations: LocationDef[];
  factions: FactionDef[];
  loreEntries?: Array<{
    id: ID;
    title: string;
    content: string;
  }>;
}

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

export interface Condition {
  id: ID;
  label?: string;
  expression: string;
}

export interface EffectTarget {
  scope: EntityScope;
  actorId?: ID;
  path: string;
}

export interface Effect {
  id: ID;
  target: EffectTarget;
  op: EffectOperation;
  value?: AttributeValue | InventoryEntry | ID;
  reason?: string;
}

export interface WorkflowNodeLike {
  id: ID;
  type:
    | "start"
    | "story"
    | "choice"
    | "condition"
    | "random"
    | "mutation"
    | "combat"
    | "end";
  title: string;
  position?: {
    x: number;
    y: number;
  };
  inputPorts: string[];
  outputPorts: string[];
  [key: string]: unknown;
}

export interface WorkflowEdge {
  id: ID;
  from: {
    nodeId: ID;
    port: string;
  };
  to: {
    nodeId: ID;
    port: string;
  };
  label?: string;
  guard?: Condition;
}

export interface GenerateWorldInput {
  genre?: string;
  tone?: string;
  playtime?: string;
  premiseHint?: string;
  mustInclude?: string[];
  avoid?: string[];
  language?: string;
}

export interface GenerateWorldOutput {
  world: WorldDef;
  items: Item[];
  suggestedGlobalState: WorldState;
  summary?: string;
}

export interface GenerateActorsInput {
  worldSummary: string;
  attributeDefs: AttributeDef[];
  actorRequirements?: string[];
  itemContext?: Item[];
  existingActors?: Actor[];
  language?: string;
}

export interface GenerateActorsOutput {
  actors: Actor[];
  relationshipNotes: string[];
  summary?: string;
}

export interface GenerateBranchesInput {
  projectMarkdownSummary: string;
  currentNode: WorkflowNodeLike;
  runtimeState?: ProjectState | Record<string, unknown>;
  existingIds: ID[];
  availableActors?: Actor[];
  availableItems?: Item[];
  availableLocations?: LocationDef[];
  attributeDefs?: AttributeDef[];
  branchCount?: number;
  requirements?: string[];
  language?: string;
}

export interface GenerateBranchesOutput {
  nodes: WorkflowNodeLike[];
  edges: WorkflowEdge[];
  summary: string;
  integrationNotes: string[];
}

export type AiDraftType = "world" | "actor" | "branch" | "node_patch";

export interface AiDraft<TPayload = unknown> {
  id: ID;
  type: AiDraftType;
  title: string;
  payload: TPayload;
  validationErrors: string[];
  createdAt: string;
  source?: {
    provider: "openai-compatible";
    model: string;
    promptKind: "world" | "actors" | "branches";
  };
  raw?: unknown;
}

export type JsonSchema = Record<string, unknown>;

const attributeValueJsonSchema: JsonSchema = {
  anyOf: [{ type: "number" }, { type: "string" }, { type: "boolean" }]
};

const idJsonSchema: JsonSchema = {
  type: "string",
  minLength: 1,
  pattern: "^[a-zA-Z0-9_:-]+$"
};

const stringArrayJsonSchema: JsonSchema = {
  type: "array",
  items: { type: "string" }
};

export const attributeDefJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["key", "label", "type"],
  properties: {
    key: idJsonSchema,
    label: { type: "string", minLength: 1 },
    type: { type: "string", enum: ["number", "string", "boolean", "enum"] },
    description: { type: "string" },
    min: { type: "number" },
    max: { type: "number" },
    enumValues: stringArrayJsonSchema,
    defaultValue: attributeValueJsonSchema
  }
};

export const worldJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["premise", "tone", "locations", "factions"],
  properties: {
    premise: { type: "string", minLength: 1 },
    tone: { type: "string", minLength: 1 },
    genre: { type: "string" },
    themes: stringArrayJsonSchema,
    locations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "summary"],
        properties: {
          id: idJsonSchema,
          name: { type: "string", minLength: 1 },
          summary: { type: "string", minLength: 1 },
          tags: stringArrayJsonSchema,
          parentLocationId: idJsonSchema
        }
      }
    },
    factions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "summary"],
        properties: {
          id: idJsonSchema,
          name: { type: "string", minLength: 1 },
          summary: { type: "string", minLength: 1 },
          alignment: { type: "string" },
          relations: {
            type: "object",
            additionalProperties: { type: "number" }
          }
        }
      }
    },
    loreEntries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "content"],
        properties: {
          id: idJsonSchema,
          title: { type: "string", minLength: 1 },
          content: { type: "string", minLength: 1 }
        }
      }
    }
  }
};

export const itemJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "type"],
  properties: {
    id: idJsonSchema,
    name: { type: "string", minLength: 1 },
    type: {
      type: "string",
      enum: ["weapon", "armor", "consumable", "quest", "material", "misc"]
    },
    description: { type: "string" },
    stackable: { type: "boolean" },
    maxStack: { type: "number" },
    attributes: {
      type: "object",
      additionalProperties: attributeValueJsonSchema
    },
    tags: stringArrayJsonSchema
  }
};

export const actorJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "role", "summary", "attributes", "inventory", "flags"],
  properties: {
    id: idJsonSchema,
    name: { type: "string", minLength: 1 },
    role: { type: "string", enum: ["player", "companion", "npc", "enemy"] },
    summary: { type: "string", minLength: 1 },
    biography: { type: "string" },
    factionId: idJsonSchema,
    locationId: idJsonSchema,
    attributes: {
      type: "object",
      additionalProperties: attributeValueJsonSchema
    },
    inventory: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["itemId", "count"],
        properties: {
          itemId: idJsonSchema,
          count: { type: "number" },
          equipped: { type: "boolean" }
        }
      }
    },
    flags: {
      type: "object",
      additionalProperties: { type: "boolean" }
    },
    relations: {
      type: "object",
      additionalProperties: { type: "number" }
    },
    tags: stringArrayJsonSchema,
    aiNotes: { type: "string" }
  }
};

export const worldStateJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["variables", "flags", "discoveredLocations"],
  properties: {
    variables: {
      type: "object",
      additionalProperties: attributeValueJsonSchema
    },
    flags: {
      type: "object",
      additionalProperties: { type: "boolean" }
    },
    discoveredLocations: {
      type: "array",
      items: idJsonSchema
    },
    completedQuests: {
      type: "array",
      items: idJsonSchema
    }
  }
};

export const conditionJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "expression"],
  properties: {
    id: idJsonSchema,
    label: { type: "string" },
    expression: { type: "string", minLength: 1 }
  }
};

export const effectJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "target", "op"],
  properties: {
    id: idJsonSchema,
    target: {
      type: "object",
      additionalProperties: false,
      required: ["scope", "path"],
      properties: {
        scope: { type: "string", enum: ["global", "player", "npc"] },
        actorId: idJsonSchema,
        path: { type: "string", minLength: 1 }
      }
    },
    op: {
      type: "string",
      enum: ["set", "inc", "dec", "append", "remove", "toggle"]
    },
    value: {
      anyOf: [
        attributeValueJsonSchema,
        {
          type: "object",
          additionalProperties: false,
          required: ["itemId", "count"],
          properties: {
            itemId: idJsonSchema,
            count: { type: "number" },
            equipped: { type: "boolean" }
          }
        }
      ]
    },
    reason: { type: "string" }
  }
};

export const workflowNodeJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: true,
  required: ["id", "type", "title", "inputPorts", "outputPorts"],
  properties: {
    id: idJsonSchema,
    type: {
      type: "string",
      enum: [
        "start",
        "story",
        "choice",
        "condition",
        "random",
        "mutation",
        "combat",
        "end"
      ]
    },
    title: { type: "string", minLength: 1 },
    position: {
      type: "object",
      additionalProperties: false,
      required: ["x", "y"],
      properties: {
        x: { type: "number" },
        y: { type: "number" }
      }
    },
    inputPorts: {
      type: "array",
      items: { type: "string" }
    },
    outputPorts: {
      type: "array",
      items: { type: "string" }
    }
  }
};

export const workflowEdgeJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "from", "to"],
  properties: {
    id: idJsonSchema,
    from: {
      type: "object",
      additionalProperties: false,
      required: ["nodeId", "port"],
      properties: {
        nodeId: idJsonSchema,
        port: { type: "string", minLength: 1 }
      }
    },
    to: {
      type: "object",
      additionalProperties: false,
      required: ["nodeId", "port"],
      properties: {
        nodeId: idJsonSchema,
        port: { type: "string", minLength: 1 }
      }
    },
    label: { type: "string" },
    guard: conditionJsonSchema
  }
};

export const generateWorldJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["world", "items", "suggestedGlobalState"],
  properties: {
    world: worldJsonSchema,
    items: {
      type: "array",
      items: itemJsonSchema
    },
    suggestedGlobalState: worldStateJsonSchema,
    summary: { type: "string" }
  }
};

export const generateActorsJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["actors", "relationshipNotes"],
  properties: {
    actors: {
      type: "array",
      items: actorJsonSchema
    },
    relationshipNotes: {
      type: "array",
      items: { type: "string" }
    },
    summary: { type: "string" }
  }
};

export const generateBranchesJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["nodes", "edges", "summary", "integrationNotes"],
  properties: {
    nodes: {
      type: "array",
      items: workflowNodeJsonSchema
    },
    edges: {
      type: "array",
      items: workflowEdgeJsonSchema
    },
    summary: { type: "string", minLength: 1 },
    integrationNotes: {
      type: "array",
      items: { type: "string" }
    }
  }
};

export const aiDraftTypeTitles: Record<AiDraftType, string> = {
  world: "世界观草稿",
  actor: "角色草稿",
  branch: "剧情分支草稿",
  node_patch: "节点补丁草稿"
};

export function validateGenerateWorldOutput(value: unknown): string[] {
  const errors: string[] = [];
  const output = asRecord(value);

  if (!output) {
    return ["AI output must be an object."];
  }

  const world = asRecord(output.world);
  if (!world) {
    errors.push("world is required.");
  } else {
    requireString(world, "premise", errors, "world.premise");
    requireString(world, "tone", errors, "world.tone");
    requireArray(world, "locations", errors, "world.locations");
    requireArray(world, "factions", errors, "world.factions");
  }

  requireArray(output, "items", errors, "items");
  const state = asRecord(output.suggestedGlobalState);
  if (!state) {
    errors.push("suggestedGlobalState is required.");
  } else {
    requireObject(state, "variables", errors, "suggestedGlobalState.variables");
    requireObject(state, "flags", errors, "suggestedGlobalState.flags");
    requireArray(
      state,
      "discoveredLocations",
      errors,
      "suggestedGlobalState.discoveredLocations"
    );
  }

  return errors;
}

export function validateGenerateActorsOutput(value: unknown): string[] {
  const errors: string[] = [];
  const output = asRecord(value);

  if (!output) {
    return ["AI output must be an object."];
  }

  const actors = requireArray(output, "actors", errors, "actors");
  if (actors) {
    actors.forEach((actor, index) => {
      const record = asRecord(actor);
      const prefix = `actors[${index}]`;
      if (!record) {
        errors.push(`${prefix} must be an object.`);
        return;
      }
      requireString(record, "id", errors, `${prefix}.id`);
      requireString(record, "name", errors, `${prefix}.name`);
      requireString(record, "role", errors, `${prefix}.role`);
      requireString(record, "summary", errors, `${prefix}.summary`);
      requireObject(record, "attributes", errors, `${prefix}.attributes`);
      requireArray(record, "inventory", errors, `${prefix}.inventory`);
      requireObject(record, "flags", errors, `${prefix}.flags`);
    });
  }

  requireArray(output, "relationshipNotes", errors, "relationshipNotes");
  return errors;
}

export function validateGenerateBranchesOutput(
  value: unknown,
  existingIds: ID[] = []
): string[] {
  const errors: string[] = [];
  const output = asRecord(value);

  if (!output) {
    return ["AI output must be an object."];
  }

  const existingIdSet = new Set(existingIds);
  const newIdSet = new Set<string>();

  const nodes = requireArray(output, "nodes", errors, "nodes");
  if (nodes) {
    nodes.forEach((node, index) => {
      const record = asRecord(node);
      const prefix = `nodes[${index}]`;
      if (!record) {
        errors.push(`${prefix} must be an object.`);
        return;
      }

      const id = requireString(record, "id", errors, `${prefix}.id`);
      requireString(record, "type", errors, `${prefix}.type`);
      requireString(record, "title", errors, `${prefix}.title`);
      requireArray(record, "inputPorts", errors, `${prefix}.inputPorts`);
      requireArray(record, "outputPorts", errors, `${prefix}.outputPorts`);

      if (id && existingIdSet.has(id)) {
        errors.push(`${prefix}.id duplicates existing id "${id}".`);
      }
      if (id && newIdSet.has(id)) {
        errors.push(`${prefix}.id duplicates another generated id "${id}".`);
      }
      if (id) {
        newIdSet.add(id);
      }
    });
  }

  const edges = requireArray(output, "edges", errors, "edges");
  if (edges) {
    edges.forEach((edge, index) => {
      const record = asRecord(edge);
      const prefix = `edges[${index}]`;
      if (!record) {
        errors.push(`${prefix} must be an object.`);
        return;
      }

      const id = requireString(record, "id", errors, `${prefix}.id`);
      if (id && existingIdSet.has(id)) {
        errors.push(`${prefix}.id duplicates existing id "${id}".`);
      }
      if (id && newIdSet.has(id)) {
        errors.push(`${prefix}.id duplicates another generated id "${id}".`);
      }
      if (id) {
        newIdSet.add(id);
      }

      requireObject(record, "from", errors, `${prefix}.from`);
      requireObject(record, "to", errors, `${prefix}.to`);
    });
  }

  requireString(output, "summary", errors, "summary");
  requireArray(output, "integrationNotes", errors, "integrationNotes");
  return errors;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  label: string
): string | null {
  if (typeof record[key] !== "string" || (record[key] as string).trim() === "") {
    errors.push(`${label} must be a non-empty string.`);
    return null;
  }

  return record[key] as string;
}

function requireArray(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  label: string
): unknown[] | null {
  if (!Array.isArray(record[key])) {
    errors.push(`${label} must be an array.`);
    return null;
  }

  return record[key] as unknown[];
}

function requireObject(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  label: string
): Record<string, unknown> | null {
  const value = asRecord(record[key]);
  if (!value) {
    errors.push(`${label} must be an object.`);
    return null;
  }

  return value;
}
