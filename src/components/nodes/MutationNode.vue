<script setup lang="ts">
import type { MutationNode as MutationWorkflowNode } from "../../domain/types";

defineProps<{
  node: MutationWorkflowNode;
  selected?: boolean;
  active?: boolean;
}>();
</script>

<template>
  <article class="mutation-node" :class="{ selected, active }">
    <header class="node-header">
      <span class="node-type">变更</span>
      <strong>{{ node.title }}</strong>
    </header>
    <ul class="effects">
      <li v-for="effect in node.effects" :key="effect.id">
        <code>{{ effect.target.scope }}.{{ effect.target.actorId ?? "self" }}.{{ effect.target.path }}</code>
        <span>{{ effect.op }} {{ effect.value }}</span>
      </li>
    </ul>
  </article>
</template>

<style scoped>
.mutation-node {
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
  border: 1px solid #f6b8b8;
  border-radius: 999px;
  color: #9f2c2c;
  font-size: 12px;
  padding: 2px 8px;
}

.effects {
  display: grid;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.effects li {
  background: #fff3f3;
  border: 1px solid #ffdada;
  border-radius: 6px;
  display: grid;
  gap: 4px;
  padding: 6px 8px;
}

.effects code {
  color: #872b2b;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.effects span {
  color: #4a2b2b;
  font-size: 12px;
}
</style>
