import { defineStore } from "pinia";
import type {
  Actor,
  GameProject,
  ID,
  Item,
  WorkflowEdge,
  WorkflowNode
} from "../domain/types";

const clone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const nowIso = () => new Date().toISOString();

export const useProjectStore = defineStore("project", {
  state: () => ({
    project: null as GameProject | null,
    dirty: false,
    validationErrors: [] as string[],
    lastSavedAt: null as string | null
  }),

  getters: {
    actorsById: (state): Record<ID, Actor> =>
      Object.fromEntries((state.project?.actors ?? []).map((actor) => [actor.id, actor])),

    itemsById: (state): Record<ID, Item> =>
      Object.fromEntries((state.project?.items ?? []).map((item) => [item.id, item])),

    nodesList: (state): WorkflowNode[] => Object.values(state.project?.workflow.nodes ?? {}),

    edgesList: (state): WorkflowEdge[] => state.project?.workflow.edges ?? [],

    player: (state): Actor | null => {
      if (!state.project) {
        return null;
      }

      return state.project.actors.find((actor) => actor.id === state.project?.state.playerId) ?? null;
    }
  },

  actions: {
    loadProject(project: GameProject) {
      this.project = clone(project);
      this.dirty = false;
      this.validationErrors = [];
      this.lastSavedAt = nowIso();
    },

    replaceProject(project: GameProject) {
      this.project = clone(project);
      this.markDirty();
    },

    clearProject() {
      this.project = null;
      this.dirty = false;
      this.validationErrors = [];
      this.lastSavedAt = null;
    },

    markDirty() {
      this.dirty = true;

      if (this.project?.meta) {
        this.project.meta.updatedAt = nowIso();
      }
    },

    markSaved() {
      this.dirty = false;
      this.lastSavedAt = nowIso();
    },

    setValidationErrors(errors: string[]) {
      this.validationErrors = [...errors];
    },

    updateMeta(patch: Partial<GameProject["meta"]>) {
      if (!this.project) {
        return;
      }

      this.project.meta = {
        ...this.project.meta,
        ...patch,
        updatedAt: nowIso()
      };
      this.markDirty();
    },

    updateWorld(patch: Partial<GameProject["world"]>) {
      if (!this.project) {
        return;
      }

      this.project.world = {
        ...this.project.world,
        ...patch
      };
      this.markDirty();
    },

    upsertActor(actor: Actor) {
      if (!this.project) {
        return;
      }

      const index = this.project.actors.findIndex((item) => item.id === actor.id);
      if (index >= 0) {
        this.project.actors.splice(index, 1, actor);
      } else {
        this.project.actors.push(actor);
      }

      this.markDirty();
    },

    removeActor(actorId: ID) {
      if (!this.project) {
        return;
      }

      this.project.actors = this.project.actors.filter((actor) => actor.id !== actorId);
      this.markDirty();
    },

    upsertItem(item: Item) {
      if (!this.project) {
        return;
      }

      const index = this.project.items.findIndex((entry) => entry.id === item.id);
      if (index >= 0) {
        this.project.items.splice(index, 1, item);
      } else {
        this.project.items.push(item);
      }

      this.markDirty();
    },

    removeItem(itemId: ID) {
      if (!this.project) {
        return;
      }

      this.project.items = this.project.items.filter((item) => item.id !== itemId);
      this.markDirty();
    },

    addNode(node: WorkflowNode) {
      if (!this.project) {
        return;
      }

      this.project.workflow.nodes[node.id] = node;
      this.markDirty();
    },

    updateNode(node: WorkflowNode) {
      if (!this.project || !this.project.workflow.nodes[node.id]) {
        return;
      }

      this.project.workflow.nodes[node.id] = node;
      this.markDirty();
    },

    patchNode(nodeId: ID, patch: Partial<WorkflowNode>) {
      if (!this.project || !this.project.workflow.nodes[nodeId]) {
        return;
      }

      this.project.workflow.nodes[nodeId] = {
        ...this.project.workflow.nodes[nodeId],
        ...patch
      } as WorkflowNode;
      this.markDirty();
    },

    removeNode(nodeId: ID) {
      if (!this.project) {
        return;
      }

      delete this.project.workflow.nodes[nodeId];
      this.project.workflow.edges = this.project.workflow.edges.filter(
        (edge) => edge.from.nodeId !== nodeId && edge.to.nodeId !== nodeId
      );
      this.markDirty();
    },

    addEdge(edge: WorkflowEdge) {
      if (!this.project) {
        return;
      }

      const exists = this.project.workflow.edges.some((item) => item.id === edge.id);
      if (!exists) {
        this.project.workflow.edges.push(edge);
        this.markDirty();
      }
    },

    removeEdge(edgeId: ID) {
      if (!this.project) {
        return;
      }

      this.project.workflow.edges = this.project.workflow.edges.filter((edge) => edge.id !== edgeId);
      this.markDirty();
    },

    validateProject(): boolean {
      const errors: string[] = [];
      const project = this.project;

      if (!project) {
        errors.push("No project loaded.");
        this.validationErrors = errors;
        return false;
      }

      if (!project.workflow.nodes[project.workflow.startNodeId]) {
        errors.push(`Start node "${project.workflow.startNodeId}" does not exist.`);
      }

      if (!project.actors.some((actor) => actor.id === project.state.playerId)) {
        errors.push(`Player actor "${project.state.playerId}" does not exist.`);
      }

      const actorIds = new Set<ID>();
      for (const actor of project.actors) {
        if (actorIds.has(actor.id)) {
          errors.push(`Duplicate actor id "${actor.id}".`);
        }
        actorIds.add(actor.id);
      }

      const itemIds = new Set<ID>();
      for (const item of project.items) {
        if (itemIds.has(item.id)) {
          errors.push(`Duplicate item id "${item.id}".`);
        }
        itemIds.add(item.id);
      }

      for (const edge of project.workflow.edges) {
        const fromNode = project.workflow.nodes[edge.from.nodeId];
        const toNode = project.workflow.nodes[edge.to.nodeId];

        if (!fromNode) {
          errors.push(`Edge "${edge.id}" references missing from node "${edge.from.nodeId}".`);
        } else if (!fromNode.outputPorts.includes(edge.from.port)) {
          errors.push(`Edge "${edge.id}" uses missing output port "${edge.from.port}".`);
        }

        if (!toNode) {
          errors.push(`Edge "${edge.id}" references missing to node "${edge.to.nodeId}".`);
        } else if (!toNode.inputPorts.includes(edge.to.port)) {
          errors.push(`Edge "${edge.id}" uses missing input port "${edge.to.port}".`);
        }
      }

      this.validationErrors = errors;
      return errors.length === 0;
    }
  }
});
