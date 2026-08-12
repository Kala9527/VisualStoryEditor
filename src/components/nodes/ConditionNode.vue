<script setup lang="ts">
import type { ConditionNode as ConditionWorkflowNode } from "../../domain/types";

defineProps<{
  node: ConditionWorkflowNode;
  selected?: boolean;
  active?: boolean;
}>();
</script>

<template>
  <article class="condition-node" :class="{ selected, active }">
    <header class="node-header">
      <span class="node-type">判断</span>
      <strong>{{ node.title }}</strong>
    </header>
    <ul class="branches">
      <li v-for="branch in node.branches" :key="branch.port">
        <strong>{{ branch.label }}</strong>
        <code>{{ branch.condition.expression }}</code>
      </li>
      <li>
        <strong>默认</strong>
        <code>{{ node.fallbackPort }}</code>
      </li>
    </ul>
  </article>
</template>

<style scoped>
.condition-node {
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
  border: 1px solid #b8dfc4;
  border-radius: 999px;
  color: #236337;
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
  background: #f1fbf4;
  border: 1px solid #d7efdd;
  border-radius: 6px;
  display: grid;
  gap: 4px;
  padding: 6px 8px;
}

.branches strong {
  color: #273043;
  font-size: 12px;
}

.branches code {
  color: #2d6841;
  font-size: 11px;
  overflow-wrap: anywhere;
}
</style>
