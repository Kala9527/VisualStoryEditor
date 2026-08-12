<script setup lang="ts">
import type { StoryNode as StoryWorkflowNode } from "../../domain/types";

defineProps<{
  node: StoryWorkflowNode;
  selected?: boolean;
  active?: boolean;
}>();
</script>

<template>
  <article class="story-node" :class="{ selected, active }">
    <header class="node-header">
      <span class="node-type">剧情</span>
      <strong>{{ node.title }}</strong>
    </header>
    <p class="story-content">{{ node.content || "尚未填写剧情正文。" }}</p>
  </article>
</template>

<style scoped>
.story-node {
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
  border: 1px solid #a6c8ff;
  border-radius: 999px;
  color: #235aa6;
  font-size: 12px;
  padding: 2px 8px;
}

.story-content {
  color: #273043;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

</style>
