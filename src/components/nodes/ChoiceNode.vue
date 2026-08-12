<script setup lang="ts">
import type { ChoiceNode as ChoiceWorkflowNode } from "../../domain/types";

defineProps<{
  node: ChoiceWorkflowNode;
  selected?: boolean;
  active?: boolean;
}>();
</script>

<template>
  <article class="choice-node" :class="{ selected, active }">
    <header class="node-header">
      <span class="node-type">选项</span>
      <strong>{{ node.title }}</strong>
    </header>
    <p class="prompt">{{ node.prompt || "尚未填写选项提示。" }}</p>
    <ol class="choices">
      <li v-for="choice in node.choices" :key="choice.id">
        <span>{{ choice.text || "未命名选项" }}</span>
        <small>{{ choice.effects?.length ?? 0 }} effects</small>
      </li>
    </ol>
  </article>
</template>

<style scoped>
.choice-node {
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
  border: 1px solid #ffd89c;
  border-radius: 999px;
  color: #8b4d00;
  font-size: 12px;
  padding: 2px 8px;
}

.prompt {
  color: #273043;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

.choices {
  display: grid;
  gap: 6px;
  list-style-position: inside;
  margin: 0;
  padding: 0;
}

.choices li {
  align-items: center;
  background: #fff8ec;
  border: 1px solid #f2d3a4;
  border-radius: 6px;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  padding: 6px 8px;
}

.choices span {
  color: #382f21;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.choices small {
  color: #916016;
  flex: none;
  font-size: 11px;
}
</style>
