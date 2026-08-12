import { defineStore } from "pinia";
import type {
  Choice,
  Condition,
  Effect,
  ID,
  NodeType,
  WorkflowEdge,
  WorkflowNode
} from "../domain/types";
import { useProjectStore } from "./projectStore";

export interface PendingConnection {
  nodeId: ID;
  port: string;
}

export interface EditorViewport {
  x: number;
  y: number;
  zoom: number;
}

const titles: Record<NodeType, string> = {
  start: "开始",
  story: "剧情节点",
  choice: "选项节点",
  condition: "条件判断",
  random: "随机分支",
  mutation: "属性变更",
  combat: "战斗节点",
  end: "结束"
};

const createId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const createDefaultCondition = (label = "条件"): Condition => ({
  id: createId("cond"),
  label,
  expression: "player.attributes.hp > 0"
});

export const createDefaultEffect = (): Effect => ({
  id: createId("effect"),
  target: {
    scope: "player",
    path: "attributes.hp"
  },
  op: "inc",
  value: 1,
  reason: "原型默认状态变更"
});

export const createDefaultChoice = (): Choice => {
  const id = createId("choice");

  return {
    id,
    text: "新的选项",
    effects: []
  };
};

export const createWorkflowNode = (
  type: NodeType,
  position = { x: 120, y: 120 }
): WorkflowNode => {
  const id = createId(`n_${type}`);
  const base = {
    id,
    type,
    title: titles[type],
    position,
    inputPorts: ["in"],
    outputPorts: ["out"]
  };

  switch (type) {
    case "start":
      return {
        ...base,
        title: "开始",
        inputPorts: [],
        outputPorts: ["out"]
      } as WorkflowNode;

    case "story":
      return {
        ...base,
        content: "这里写入剧情正文、旁白或角色对白。",
        sceneTags: []
      } as WorkflowNode;

    case "choice": {
      const choice = createDefaultChoice();
      return {
        ...base,
        prompt: "玩家要怎么做？",
        choices: [choice],
        outputPorts: [`choice:${choice.id}`]
      } as WorkflowNode;
    }

    case "condition":
      return {
        ...base,
        branches: [
          {
            port: "pass",
            label: "满足条件",
            condition: createDefaultCondition("满足条件")
          }
        ],
        fallbackPort: "fallback",
        outputPorts: ["pass", "fallback"]
      } as WorkflowNode;

    case "random":
      return {
        ...base,
        branches: [
          { port: "a", label: "分支 A", weight: 50 },
          { port: "b", label: "分支 B", weight: 50 }
        ],
        outputPorts: ["a", "b"]
      } as WorkflowNode;

    case "mutation":
      return {
        ...base,
        effects: [createDefaultEffect()]
      } as WorkflowNode;

    case "combat":
      return {
        ...base,
        enemies: [],
        escapeAllowed: true,
        winEffects: [],
        loseEffects: [],
        escapeEffects: [],
        outputPorts: ["win", "lose", "escape", "dead"]
      } as WorkflowNode;

    case "end":
      return {
        ...base,
        outputPorts: [],
        endingId: createId("ending"),
        endingTitle: "结局",
        endingSummary: "这里描述该分支结局。"
      } as WorkflowNode;

    default:
      return base as WorkflowNode;
  }
};

export const useWorkflowStore = defineStore("workflow", {
  state: () => ({
    selectedNodeId: null as ID | null,
    selectedEdgeId: null as ID | null,
    viewport: { x: 0, y: 0, zoom: 1 } as EditorViewport,
    pendingConnection: null as PendingConnection | null,
    clipboardNodeIds: [] as ID[],
    lastError: ""
  }),

  getters: {
    selectedNode(): WorkflowNode | null {
      const projectStore = useProjectStore();

      if (!projectStore.project || !this.selectedNodeId) {
        return null;
      }

      return projectStore.project.workflow.nodes[this.selectedNodeId] ?? null;
    },

    selectedEdge(): WorkflowEdge | null {
      const projectStore = useProjectStore();

      if (!projectStore.project || !this.selectedEdgeId) {
        return null;
      }

      return projectStore.project.workflow.edges.find((edge) => edge.id === this.selectedEdgeId) ?? null;
    }
  },

  actions: {
    selectNode(nodeId: ID | null) {
      this.selectedNodeId = nodeId;
      this.selectedEdgeId = null;
      this.lastError = "";
    },

    selectEdge(edgeId: ID | null) {
      this.selectedEdgeId = edgeId;
      this.selectedNodeId = null;
      this.lastError = "";
    },

    setViewport(viewport: Partial<EditorViewport>) {
      this.viewport = {
        ...this.viewport,
        ...viewport,
        zoom: Math.max(0.2, Math.min(2, viewport.zoom ?? this.viewport.zoom))
      };
    },

    addNode(type: NodeType) {
      const projectStore = useProjectStore();

      if (!projectStore.project) {
        this.lastError = "请先创建或导入项目。";
        return null;
      }

      const count = Object.keys(projectStore.project.workflow.nodes).length;
      const node = createWorkflowNode(type, {
        x: 120 + (count % 4) * 260,
        y: 120 + Math.floor(count / 4) * 180
      });

      projectStore.addNode(node);
      this.selectNode(node.id);
      return node;
    },

    updateNode(node: WorkflowNode) {
      const projectStore = useProjectStore();
      projectStore.updateNode(node);
    },

    moveNode(nodeId: ID, position: { x: number; y: number }) {
      const projectStore = useProjectStore();
      const node = projectStore.project?.workflow.nodes[nodeId];

      if (!node) {
        return;
      }

      projectStore.patchNode(nodeId, {
        position: {
          x: Math.round(position.x),
          y: Math.round(position.y)
        }
      } as Partial<WorkflowNode>);
    },

    removeSelected() {
      const projectStore = useProjectStore();

      if (this.selectedNodeId) {
        projectStore.removeNode(this.selectedNodeId);
        this.selectNode(null);
        return;
      }

      if (this.selectedEdgeId) {
        projectStore.removeEdge(this.selectedEdgeId);
        this.selectEdge(null);
      }
    },

    beginConnection(nodeId: ID, port: string) {
      this.pendingConnection = { nodeId, port };
      this.lastError = "";
    },

    cancelConnection() {
      this.pendingConnection = null;
    },

    completeConnection(toNodeId: ID, toPort = "in") {
      const projectStore = useProjectStore();
      const project = projectStore.project;
      const pending = this.pendingConnection;

      if (!project || !pending) {
        return null;
      }

      if (pending.nodeId === toNodeId) {
        this.lastError = "暂不允许节点连接到自身。";
        this.pendingConnection = null;
        return null;
      }

      const toNode = project.workflow.nodes[toNodeId];
      if (!toNode?.inputPorts.includes(toPort)) {
        this.lastError = `目标节点没有输入端口 ${toPort}。`;
        this.pendingConnection = null;
        return null;
      }

      const edge: WorkflowEdge = {
        id: createId("edge"),
        from: {
          nodeId: pending.nodeId,
          port: pending.port
        },
        to: {
          nodeId: toNodeId,
          port: toPort
        }
      };

      projectStore.addEdge(edge);
      this.selectEdge(edge.id);
      this.pendingConnection = null;
      return edge;
    },

    connectNodes(fromNodeId: ID, fromPort: string, toNodeId: ID, toPort = "in") {
      this.beginConnection(fromNodeId, fromPort);
      return this.completeConnection(toNodeId, toPort);
    },

    removeEdge(edgeId: ID) {
      const projectStore = useProjectStore();
      projectStore.removeEdge(edgeId);

      if (this.selectedEdgeId === edgeId) {
        this.selectEdge(null);
      }
    },

    copySelectedNode() {
      this.clipboardNodeIds = this.selectedNodeId ? [this.selectedNodeId] : [];
    }
  }
});
