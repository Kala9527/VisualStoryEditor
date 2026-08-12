<script setup lang="ts">
import type { NodeType } from "../../domain/types";
import { useWorkflowStore } from "../../stores/workflowStore";

const workflowStore = useWorkflowStore();

interface PaletteItem {
  type: NodeType;
  label: string;
  description: string;
}

const items: PaletteItem[] = [
  { type: "story", label: "剧情", description: "旁白、对白、场景描述" },
  { type: "choice", label: "选项", description: "玩家选择与分支出口" },
  { type: "condition", label: "判断", description: "属性、物品、flag 条件" },
  { type: "random", label: "随机", description: "按权重进入不同结果" },
  { type: "mutation", label: "变更", description: "修改全局、玩家、NPC 状态" },
  { type: "combat", label: "战斗", description: "战斗胜负、逃跑、死亡出口" },
  { type: "end", label: "结束", description: "记录结局并终止运行" }
];
</script>

<template>
  <aside class="node-palette" aria-label="节点组件库">
    <header>
      <h2>节点库</h2>
      <p>添加剧情工作流组件</p>
    </header>

    <div class="palette-list">
      <button
        v-for="item in items"
        :key="item.type"
        class="palette-item"
        type="button"
        :title="item.description"
        @click="workflowStore.addNode(item.type)"
      >
        <span>{{ item.label }}</span>
        <small>{{ item.description }}</small>
      </button>
    </div>

    <p v-if="workflowStore.lastError" class="palette-error">{{ workflowStore.lastError }}</p>
  </aside>
</template>

<style scoped>
.node-palette {
  background: #f8fafc;
  border-right: 1px solid #d9e1ec;
  display: grid;
  gap: 16px;
  grid-template-rows: auto 1fr auto;
  min-width: 220px;
  padding: 18px;
}

header {
  display: grid;
  gap: 4px;
}

h2,
p {
  margin: 0;
}

h2 {
  color: #172033;
  font-size: 18px;
}

p {
  color: #64748b;
  font-size: 12px;
}

.palette-list {
  align-content: start;
  display: grid;
  gap: 10px;
}

.palette-item {
  background: #ffffff;
  border: 1px solid #d9e1ec;
  border-radius: 8px;
  cursor: pointer;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  text-align: left;
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease,
    transform 120ms ease;
}

.palette-item:hover {
  border-color: #7aa7ff;
  box-shadow: 0 8px 20px rgba(42, 87, 154, 0.12);
  transform: translateY(-1px);
}

.palette-item span {
  color: #172033;
  font-size: 14px;
  font-weight: 700;
}

.palette-item small {
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}

.palette-error {
  background: #fff1f1;
  border: 1px solid #ffd2d2;
  border-radius: 6px;
  color: #9f2c2c;
  padding: 8px;
}
</style>
