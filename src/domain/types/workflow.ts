import type { AttributeValue, EntityScope, ID } from "./project";
import type { InventoryEntry } from "./item";

export type NodeType =
  | "start"
  | "story"
  | "choice"
  | "condition"
  | "random"
  | "mutation"
  | "combat"
  | "end";

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

export type EffectOperation =
  | "set"
  | "inc"
  | "dec"
  | "append"
  | "remove"
  | "toggle";

export interface Effect {
  id: ID;
  target: EffectTarget;
  op: EffectOperation;
  value?: AttributeValue | InventoryEntry | ID;
  reason?: string;
}

export interface WorkflowNodeBase {
  id: ID;
  type: NodeType;
  title: string;
  position: {
    x: number;
    y: number;
  };
  inputPorts: string[];
  outputPorts: string[];
}

export interface StartNode extends WorkflowNodeBase {
  type: "start";
  inputPorts: string[];
  outputPorts: string[];
}

export interface StoryNode extends WorkflowNodeBase {
  type: "story";
  content: string;
  speakerId?: ID;
  locationId?: ID;
  sceneTags?: string[];
}

export interface Choice {
  id: ID;
  text: string;
  visibleWhen?: Condition[];
  enabledWhen?: Condition[];
  effects?: Effect[];
  nextNodeId?: ID;
}

export interface ChoiceNode extends WorkflowNodeBase {
  type: "choice";
  prompt: string;
  choices: Choice[];
}

export interface ConditionBranch {
  port: string;
  label: string;
  condition: Condition;
}

export interface ConditionNode extends WorkflowNodeBase {
  type: "condition";
  branches: ConditionBranch[];
  fallbackPort: string;
}

export interface RandomBranch {
  port: string;
  label: string;
  weight: number;
}

export interface RandomNode extends WorkflowNodeBase {
  type: "random";
  branches: RandomBranch[];
  seedKey?: string;
}

export interface MutationNode extends WorkflowNodeBase {
  type: "mutation";
  effects: Effect[];
}

export interface CombatEnemy {
  actorId: ID;
  level?: number;
}

export interface CombatNode extends WorkflowNodeBase {
  type: "combat";
  enemies: CombatEnemy[];
  escapeAllowed: boolean;
  winEffects?: Effect[];
  loseEffects?: Effect[];
  escapeEffects?: Effect[];
}

export interface EndNode extends WorkflowNodeBase {
  type: "end";
  endingId: string;
  endingTitle: string;
  endingSummary: string;
}

export type WorkflowNode =
  | StartNode
  | StoryNode
  | ChoiceNode
  | ConditionNode
  | RandomNode
  | MutationNode
  | CombatNode
  | EndNode;

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

export interface WorkflowGraph {
  startNodeId: ID;
  nodes: Record<ID, WorkflowNode>;
  edges: WorkflowEdge[];
}
