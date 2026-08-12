<script setup lang="ts">
import { computed, ref } from "vue";
import type { ID, WorkflowEdge, WorkflowNode } from "../../domain/types";
import { useProjectStore } from "../../stores/projectStore";
import { useRuntimeStore } from "../../stores/runtimeStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useWorkflowStore } from "../../stores/workflowStore";
import ChoiceNode from "../nodes/ChoiceNode.vue";
import CombatNode from "../nodes/CombatNode.vue";
import ConditionNode from "../nodes/ConditionNode.vue";
import MutationNode from "../nodes/MutationNode.vue";
import RandomNode from "../nodes/RandomNode.vue";
import StoryNode from "../nodes/StoryNode.vue";

const projectStore = useProjectStore();
const workflowStore = useWorkflowStore();
const runtimeStore = useRuntimeStore();
const settingsStore = useSettingsStore();

const dragging = ref<{
  nodeId: ID;
  offsetX: number;
  offsetY: number;
} | null>(null);
const panning = ref<{
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
} | null>(null);

const nodes = computed(() => projectStore.nodesList);
const edges = computed(() => projectStore.edgesList);
const canvasPadding = 120;
const canvasOffsetX = 120;
const canvasOffsetY = 260;
const nodeWidth = 240;
const nodeMinHeight = 104;
const edgeParallelSpacing = 34;

const bounds = computed(() => {
  if (!nodes.value.length) {
    return {
      width: 1200,
      height: 760
    };
  }

  const maxX = Math.max(...nodes.value.map((node) => node.position.x + nodeWidth));
  const maxY = Math.max(...nodes.value.map((node) => node.position.y + nodeMinHeight));

  return {
    width: Math.max(1200, maxX + canvasOffsetX + canvasPadding),
    height: Math.max(760, maxY + canvasOffsetY + canvasPadding)
  };
});

const contentStyle = computed(() => ({
  width: `${bounds.value.width}px`,
  height: `${bounds.value.height}px`
}));

const canvasClass = computed(() => ({
  "show-grid": settingsStore.showGrid
}));

const nodeStyle = (node: WorkflowNode) => ({
  transform: `translate(${node.position.x + canvasOffsetX}px, ${node.position.y + canvasOffsetY}px)`
});

const parallelEdgeLayout = computed(() => {
  const groups = new Map<string, WorkflowEdge[]>();
  const layout = new Map<ID, { offset: number; total: number }>();

  edges.value.forEach((edge) => {
    const key = `${edge.from.nodeId}->${edge.to.nodeId}`;
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  });

  groups.forEach((group) => {
    const center = (group.length - 1) / 2;
    group.forEach((edge, index) => {
      layout.set(edge.id, {
        offset: (index - center) * edgeParallelSpacing,
        total: group.length
      });
    });
  });

  return layout;
});

const getEdgeGeometry = (edge: WorkflowEdge) => {
  const fromNode = projectStore.project?.workflow.nodes[edge.from.nodeId];
  const toNode = projectStore.project?.workflow.nodes[edge.to.nodeId];

  if (!fromNode || !toNode) {
    return null;
  }

  const layout = parallelEdgeLayout.value.get(edge.id);
  const offset = layout?.total === 1 ? 0 : layout?.offset ?? 0;
  const startX = fromNode.position.x + canvasOffsetX + nodeWidth;
  const startY = fromNode.position.y + canvasOffsetY + 58 + offset;
  const endX = toNode.position.x + canvasOffsetX;
  const endY = toNode.position.y + canvasOffsetY + 58 + offset;
  const controlX = startX + Math.max(80, (endX - startX) / 2);

  return {
    startX,
    startY,
    controlX,
    endX,
    endY
  };
};

const cubicPoint = (start: number, controlA: number, controlB: number, end: number, t: number) => {
  const inverse = 1 - t;

  return (
    inverse ** 3 * start +
    3 * inverse ** 2 * t * controlA +
    3 * inverse * t ** 2 * controlB +
    t ** 3 * end
  );
};

const edgePath = (edge: WorkflowEdge) => {
  const geometry = getEdgeGeometry(edge);

  if (!geometry) {
    return "";
  }

  return `M ${geometry.startX} ${geometry.startY} C ${geometry.controlX} ${geometry.startY}, ${geometry.controlX} ${geometry.endY}, ${geometry.endX} ${geometry.endY}`;
};

const edgeLabelPosition = (edge: WorkflowEdge) => {
  const geometry = getEdgeGeometry(edge);

  if (!geometry) {
    return { left: "0px", top: "0px" };
  }

  const labelX = cubicPoint(geometry.startX, geometry.controlX, geometry.controlX, geometry.endX, 0.5);
  const labelY = cubicPoint(geometry.startY, geometry.startY, geometry.endY, geometry.endY, 0.5);

  return {
    left: `${labelX}px`,
    top: `${labelY}px`
  };
};

const startDrag = (event: PointerEvent, node: WorkflowNode) => {
  const target = event.target as HTMLElement;
  if (target.closest("button")) {
    return;
  }

  dragging.value = {
    nodeId: node.id,
    offsetX: event.clientX - node.position.x,
    offsetY: event.clientY - node.position.y
  };
  workflowStore.selectNode(node.id);
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};

const dragNode = (event: PointerEvent) => {
  if (!dragging.value) {
    return;
  }

  const gridSize = settingsStore.gridSize;
  const x = event.clientX - dragging.value.offsetX;
  const y = event.clientY - dragging.value.offsetY;

  workflowStore.moveNode(dragging.value.nodeId, {
    x: settingsStore.snapToGrid ? Math.round(x / gridSize) * gridSize : x,
    y: settingsStore.snapToGrid ? Math.round(y / gridSize) * gridSize : y
  });
};

const endDrag = () => {
  dragging.value = null;
};

const startConnection = (node: WorkflowNode, port: string) => {
  workflowStore.beginConnection(node.id, port);
};

const completeConnection = (node: WorkflowNode) => {
  if (workflowStore.pendingConnection) {
    workflowStore.completeConnection(node.id, node.inputPorts[0] ?? "in");
  }
};

const startPan = (event: PointerEvent) => {
  const target = event.target as HTMLElement;

  if (target.closest("button") || target.closest(".canvas-node")) {
    return;
  }

  const canvas = event.currentTarget as HTMLElement;
  panning.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: canvas.scrollLeft,
    scrollTop: canvas.scrollTop
  };
  canvas.setPointerCapture(event.pointerId);
};

const panCanvas = (event: PointerEvent) => {
  if (!panning.value) {
    return;
  }

  const canvas = event.currentTarget as HTMLElement;
  canvas.scrollLeft = panning.value.scrollLeft - (event.clientX - panning.value.startX);
  canvas.scrollTop = panning.value.scrollTop - (event.clientY - panning.value.startY);
};

const endPan = (event: PointerEvent) => {
  if (panning.value?.pointerId === event.pointerId) {
    panning.value = null;
  }
};
</script>

<template>
  <section
    class="node-canvas"
    :class="[canvasClass, { panning }]"
    aria-label="剧情工作流画布"
    @click.self="workflowStore.selectNode(null)"
    @pointerdown="startPan"
    @pointermove="panCanvas"
    @pointerup="endPan"
    @pointercancel="endPan"
  >
    <div v-if="!projectStore.project" class="empty-state">
      <h2>等待项目</h2>
      <p>创建或导入项目后，可在这里编辑剧情节点图。</p>
    </div>

    <template v-else>
      <div class="canvas-content" :style="contentStyle" @click.self="workflowStore.selectNode(null)">
        <svg class="edge-layer" aria-hidden="true">
          <path
            v-for="edge in edges"
            :key="edge.id"
            class="edge-path"
            :class="{ selected: workflowStore.selectedEdgeId === edge.id }"
            :d="edgePath(edge)"
            @click.stop="workflowStore.selectEdge(edge.id)"
          />
        </svg>

        <button
          v-for="edge in edges"
          :key="`${edge.id}-label`"
          type="button"
          class="edge-label"
          :class="{ selected: workflowStore.selectedEdgeId === edge.id }"
          :style="edgeLabelPosition(edge)"
          @click.stop="workflowStore.selectEdge(edge.id)"
        >
          {{ edge.label || edge.from.port }}
        </button>

        <div
          v-for="node in nodes"
          :key="node.id"
          class="canvas-node"
          :class="[
            `node-${node.type}`,
            {
              selected: workflowStore.selectedNodeId === node.id,
              active: runtimeStore.currentNodeId === node.id,
              compact: settingsStore.compactNodes
            }
          ]"
          :style="nodeStyle(node)"
          @pointerdown="startDrag($event, node)"
          @pointermove="dragNode"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @dblclick.stop="completeConnection(node)"
        >
          <button
            v-if="node.inputPorts.length"
            type="button"
            class="port input-port"
            title="连接到此输入端口"
            @click.stop="completeConnection(node)"
          />

          <StoryNode v-if="node.type === 'story'" :node="node" />
          <ChoiceNode v-else-if="node.type === 'choice'" :node="node" />
          <ConditionNode v-else-if="node.type === 'condition'" :node="node" />
          <RandomNode v-else-if="node.type === 'random'" :node="node" />
          <MutationNode v-else-if="node.type === 'mutation'" :node="node" />
          <CombatNode v-else-if="node.type === 'combat'" :node="node" />

          <article v-else class="generic-node">
            <header>
              <span>{{ node.type }}</span>
              <strong>{{ node.title }}</strong>
            </header>
            <p>{{ node.id }}</p>
          </article>

          <div v-if="node.outputPorts.length" class="output-ports">
            <button
              v-for="port in node.outputPorts"
              :key="port"
              type="button"
              class="output-port"
              :title="`从 ${port} 开始连线`"
              @click.stop="startConnection(node, port)"
            >
              {{ port }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.node-canvas {
  background: #edf2f7;
  cursor: grab;
  height: 100%;
  min-height: 0;
  overflow: auto;
  position: relative;
  user-select: none;
}

.node-canvas.panning {
  cursor: grabbing;
}

.canvas-content {
  min-height: 100%;
  min-width: 100%;
  position: relative;
}

.node-canvas.show-grid {
  background-image:
    linear-gradient(#dbe3ee 1px, transparent 1px),
    linear-gradient(90deg, #dbe3ee 1px, transparent 1px);
  background-size: 24px 24px;
}

.empty-state {
  display: grid;
  gap: 8px;
  left: 50%;
  place-items: center;
  position: absolute;
  text-align: center;
  top: 50%;
  transform: translate(-50%, -50%);
}

.empty-state h2,
.empty-state p {
  margin: 0;
}

.empty-state h2 {
  color: #172033;
  font-size: 22px;
}

.empty-state p {
  color: #64748b;
  font-size: 14px;
}

.edge-layer {
  height: 100%;
  left: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  width: 100%;
}

.edge-path {
  fill: none;
  pointer-events: stroke;
  stroke: #7890aa;
  stroke-width: 2.5;
}

.edge-path.selected {
  stroke: #2563eb;
  stroke-width: 4;
}

.edge-label {
  background: #ffffff;
  border: 1px solid #c7d2e1;
  border-radius: 999px;
  color: #334155;
  cursor: pointer;
  font-size: 11px;
  max-width: 120px;
  overflow: hidden;
  padding: 3px 8px;
  position: absolute;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edge-label.selected {
  border-color: #2563eb;
  color: #1d4ed8;
}

.canvas-node {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.12);
  cursor: grab;
  min-height: 104px;
  padding: 12px;
  position: absolute;
  width: 240px;
}

.canvas-node:active {
  cursor: grabbing;
}

.canvas-node.selected {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18), 0 14px 32px rgba(15, 23, 42, 0.12);
}

.canvas-node.active {
  outline: 3px solid rgba(22, 163, 74, 0.24);
}

.canvas-node.compact {
  min-height: 80px;
}

.generic-node {
  display: grid;
  gap: 8px;
}

.generic-node header {
  display: flex;
  justify-content: space-between;
}

.generic-node span {
  color: #64748b;
  font-size: 12px;
}

.generic-node strong {
  color: #172033;
  font-size: 14px;
}

.generic-node p {
  color: #64748b;
  font-size: 12px;
  margin: 0;
}

.port {
  border: 2px solid #ffffff;
  border-radius: 999px;
  cursor: pointer;
  height: 14px;
  position: absolute;
  top: 48px;
  width: 14px;
}

.input-port {
  background: #2563eb;
  left: -7px;
}

.output-ports {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 10px;
}

.output-port {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  color: #334155;
  cursor: pointer;
  font-size: 11px;
  max-width: 100px;
  overflow: hidden;
  padding: 3px 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.output-port:hover {
  border-color: #2563eb;
  color: #1d4ed8;
}
</style>
