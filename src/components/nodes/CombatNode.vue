<script setup lang="ts">
import type { CombatNode as CombatWorkflowNode } from "../../domain/types";

defineProps<{
  node: CombatWorkflowNode;
  selected?: boolean;
  active?: boolean;
}>();
</script>

<template>
  <article class="combat-node" :class="{ selected, active }">
    <header class="node-header">
      <span class="node-type">战斗</span>
      <strong>{{ node.title }}</strong>
    </header>
    <dl class="combat-stats">
      <div>
        <dt>敌人</dt>
        <dd>{{ node.enemies.length }}</dd>
      </div>
      <div>
        <dt>可逃跑</dt>
        <dd>{{ node.escapeAllowed ? "是" : "否" }}</dd>
      </div>
      <div class="enemy-bindings">
        <dt>绑定 ID</dt>
        <dd>{{ node.enemies.map((enemy) => enemy.actorId).join(", ") || "未绑定" }}</dd>
      </div>
    </dl>
  </article>
</template>

<style scoped>
.combat-node {
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
  border: 1px solid #ffb0c8;
  border-radius: 999px;
  color: #a8174c;
  font-size: 12px;
  padding: 2px 8px;
}

.combat-stats {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
}

.combat-stats .enemy-bindings {
  grid-column: 1 / -1;
}

.combat-stats div {
  background: #fff1f6;
  border: 1px solid #ffd7e4;
  border-radius: 6px;
  padding: 8px;
}

.combat-stats dt {
  color: #7a3a52;
  font-size: 11px;
}

.combat-stats dd {
  color: #2d1f25;
  font-size: 16px;
  font-weight: 700;
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.combat-stats .enemy-bindings dd {
  font-size: 12px;
}
</style>
