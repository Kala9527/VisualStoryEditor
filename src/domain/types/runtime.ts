import type { Actor } from "./actor";
import type { Item } from "./item";
import type { GameProject, ID, ProjectState } from "./project";
import type { Choice, NodeType, WorkflowNode } from "./workflow";

export interface StateDiff {
  path: string;
  before: unknown;
  after: unknown;
  effectId?: ID;
  reason?: string;
}

export interface RuntimeLog {
  id: ID;
  nodeId: ID;
  nodeType: NodeType;
  selectedChoiceId?: ID;
  outputPort?: string;
  conditionResult?: {
    expression: string;
    result: boolean;
  };
  randomResult?: {
    port: string;
    seed?: string;
    roll?: number;
  };
  combatResult?: CombatResult;
  diffs: StateDiff[];
  nextNodeId?: ID;
  createdAt: string;
}

export interface RuntimeContext {
  project: GameProject;
  currentNodeId: ID;
  state: ProjectState;
  actorsById: Record<ID, Actor>;
  itemsById: Record<ID, Item>;
  history: RuntimeLog[];
  randomSeed?: string;
}

export type RuntimeStatus = "running" | "waiting" | "ended" | "error";

export interface RuntimeChoiceView {
  choice: Choice;
  visible: boolean;
  enabled: boolean;
  hiddenReasons: string[];
  disabledReasons: string[];
}

export type CombatResult = "win" | "lose" | "escape" | "dead";

export interface ExecutorInput {
  choiceId?: ID;
  combatResult?: CombatResult;
  continue?: boolean;
}

export interface ExecutorStepResult {
  status: RuntimeStatus;
  node: WorkflowNode;
  context: RuntimeContext;
  availableChoices?: RuntimeChoiceView[];
  log?: RuntimeLog;
  message?: string;
}
