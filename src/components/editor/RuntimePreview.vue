<script setup lang="ts">
import { computed } from "vue";
import type { CombatNode, CombatResult } from "../../domain/types";
import { useProjectStore } from "../../stores/projectStore";
import { useRuntimeStore } from "../../stores/runtimeStore";

const projectStore = useProjectStore();
const runtimeStore = useRuntimeStore();

const currentNode = computed(() => runtimeStore.currentNode);
const combatNode = computed(() =>
  currentNode.value?.type === "combat" ? (currentNode.value as CombatNode) : null
);
const snapshotJson = computed(() =>
  runtimeStore.stateSnapshot
    ? JSON.stringify(
        {
          state: runtimeStore.stateSnapshot,
          actors: runtimeStore.actorSnapshots
        },
        null,
        2
      )
    : "{}"
);

const canContinue = computed(() => currentNode.value?.type === "story" && runtimeStore.status === "running");
const canResolveCombat = computed(() => Boolean(combatNode.value) && runtimeStore.status === "waiting_combat");
const canStart = computed(() => Boolean(projectStore.project));
const combatResults: Array<{ result: CombatResult; label: string; hint: string }> = [
  { result: "win", label: "胜利", hint: "win" },
  { result: "lose", label: "失败", hint: "lose" },
  { result: "escape", label: "逃跑", hint: "escape" },
  { result: "dead", label: "死亡", hint: "dead" }
];

const start = () => {
  if (projectStore.project) {
    runtimeStore.start(projectStore.project);
  }
};

const canUseCombatResult = (result: CombatResult) => {
  const combat = combatNode.value;

  if (!combat || !combat.outputPorts.includes(result)) {
    return false;
  }

  return result !== "escape" || combat.escapeAllowed;
};

const getCombatResultHint = (result: CombatResult) => {
  const combat = combatNode.value;

  if (!combat?.outputPorts.includes(result)) {
    return "缺少端口";
  }

  if (result === "escape" && !combat.escapeAllowed) {
    return "不可逃跑";
  }

  return result;
};
</script>

<template>
  <aside class="runtime-preview" aria-label="运行预览">
    <header class="preview-header">
      <div>
        <h2>运行预览</h2>
        <p>{{ runtimeStore.status }}</p>
      </div>
      <div class="actions">
        <button type="button" :disabled="!canStart" @click="start">运行</button>
        <button type="button" :disabled="runtimeStore.status === 'idle'" @click="runtimeStore.stop()">停止</button>
      </div>
    </header>

    <section class="scene-panel">
      <template v-if="runtimeStore.ending">
        <span class="eyebrow">结局</span>
        <h3>{{ runtimeStore.ending.endingTitle }}</h3>
        <p>{{ runtimeStore.ending.endingSummary }}</p>
      </template>

      <template v-else-if="currentNode">
        <span class="eyebrow">{{ currentNode.type }} / {{ currentNode.id }}</span>
        <h3>{{ currentNode.title }}</h3>
        <p>{{ runtimeStore.lastNarration || "该节点会自动执行并跳转。" }}</p>

        <button v-if="canContinue" type="button" class="primary" @click="runtimeStore.continueStory()">继续</button>

        <div v-if="runtimeStore.visibleChoices.length" class="choice-list">
          <button
            v-for="choice in runtimeStore.visibleChoices.filter((item) => item.visible)"
            :key="choice.id"
            type="button"
            :disabled="!choice.enabled"
            @click="runtimeStore.choose(choice.id)"
          >
            <span>{{ choice.text }}</span>
            <small v-if="choice.reason">{{ choice.reason }}</small>
          </button>
        </div>

        <div v-if="canResolveCombat" class="combat-result-list">
          <button
            v-for="entry in combatResults"
            :key="entry.result"
            type="button"
            :disabled="!canUseCombatResult(entry.result)"
            @click="runtimeStore.resolveCombat(entry.result)"
          >
            <span>{{ entry.label }}</span>
            <small>{{ getCombatResultHint(entry.result) }}</small>
          </button>
        </div>
      </template>

      <template v-else>
        <span class="eyebrow">空闲</span>
        <h3>尚未开始运行</h3>
        <p>点击运行后，执行器会从 start 节点进入工作流。</p>
      </template>

      <p v-if="runtimeStore.lastError" class="runtime-error">{{ runtimeStore.lastError }}</p>
    </section>

    <section class="state-panel">
      <div class="section-title">
        <h3>状态快照</h3>
        <small>{{ runtimeStore.history.length }} logs</small>
      </div>
      <pre>{{ snapshotJson }}</pre>
    </section>

    <section class="history-panel">
      <div class="section-title">
        <h3>执行日志</h3>
      </div>
      <ol>
        <li v-for="log in runtimeStore.history.slice().reverse()" :key="log.id">
          <strong>{{ log.nodeType }}</strong>
          <span>{{ log.nodeId }}</span>
          <small v-if="log.nextNodeId">-> {{ log.nextNodeId }}</small>
          <em v-if="log.diffs.length">{{ log.diffs.length }} diffs</em>
        </li>
      </ol>
    </section>
  </aside>
</template>

<style scoped>
.runtime-preview {
  background: #f8fafc;
  border-left: 1px solid #d9e1ec;
  display: grid;
  gap: 14px;
  grid-template-rows: auto minmax(180px, auto) minmax(180px, 1fr) minmax(180px, 1fr);
  min-height: 0;
  overflow: auto;
  padding: 16px 18px;
}

.preview-header,
.scene-panel,
.state-panel,
.history-panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}

.preview-header {
  align-content: space-between;
  display: grid;
  gap: 12px;
}

h2,
h3,
p,
ol {
  margin: 0;
}

h2 {
  color: #172033;
  font-size: 17px;
}

h3 {
  color: #172033;
  font-size: 15px;
}

p {
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.preview-header p,
.eyebrow,
small {
  color: #64748b;
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
}

button {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #334155;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 10px;
}

button:hover:not(:disabled) {
  border-color: #2563eb;
  color: #1d4ed8;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
  margin-top: 12px;
}

.primary:hover:not(:disabled) {
  background: #1d4ed8;
  color: #ffffff;
}

.scene-panel,
.state-panel,
.history-panel {
  align-content: start;
  display: grid;
  gap: 10px;
  min-height: 0;
  overflow: auto;
}

.choice-list {
  display: grid;
  gap: 8px;
}

.choice-list button,
.combat-result-list button {
  display: grid;
  gap: 4px;
  justify-content: space-between;
  text-align: left;
}

.combat-result-list {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.combat-result-list button {
  background: #fff7ed;
  border-color: #fed7aa;
}

.combat-result-list button:hover:not(:disabled) {
  border-color: #ea580c;
  color: #c2410c;
}

.runtime-error {
  background: #fff1f1;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #b91c1c;
  padding: 8px;
}

.section-title {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

pre {
  background: #0f172a;
  border-radius: 6px;
  color: #dbeafe;
  font-size: 11px;
  line-height: 1.5;
  margin: 0;
  overflow: auto;
  padding: 10px;
}

ol {
  display: grid;
  gap: 6px;
  list-style: none;
  padding: 0;
}

li {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  display: grid;
  gap: 3px;
  grid-template-columns: auto 1fr auto auto;
  padding: 7px 8px;
}

li strong {
  color: #172033;
  font-size: 12px;
}

li span,
li small,
li em {
  color: #64748b;
  font-size: 11px;
  overflow-wrap: anywhere;
}

li em {
  color: #2563eb;
  font-style: normal;
}
</style>
