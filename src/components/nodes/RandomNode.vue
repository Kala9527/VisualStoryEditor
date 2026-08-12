<script setup lang="ts">
import type { RandomNode as RandomWorkflowNode } from "../../domain/types";

defineProps<{
  node: RandomWorkflowNode;
  selected?: boolean;
  active?: boolean;
}>();

const percent = (weight: number, total: number) => {
  if (!total) {
    return "0%";
  }

  return `${Math.round((weight / total) * 100)}%`;
};
</script>

<template>
  <article class="random-node" :class="{ selected, active }">
    <header class="node-header">
      <span class="node-type">随机</span>
      <strong>{{ node.title }}</strong>
    </header>
    <ul class="branches">
      <li v-for="branch in node.branches" :key="branch.port">
        <span>{{ branch.label }}</span>
        <strong>{{ percent(branch.weight, node.branches.reduce((sum, item) => sum + item.weight, 0)) }}</strong>
      </li>
    </ul>
  </article>
</template>

<style scoped>
.random-node {
  display: grid;
  gap: 10px;
}

.node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.node-type {
  border: 1px solid #d7c4ff;
  border-radius: 999px;
  color: #5a37a6;
  font-size: 12px;
  padding: 2px 8px;
}

.branches {
  display: grid;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.branches li {
  align-items: center;
  background: #f7f2ff;
  border: 1px solid #e5d8ff;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  padding: 6px 8px;
}

.branches span,
.branches strong {
  color: #31254a;
  font-size: 12px;
}
</style>
