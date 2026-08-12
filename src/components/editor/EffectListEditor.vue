<script setup lang="ts">
import type { Effect, EntityScope } from "../../domain/types";

interface EffectTargetOption {
  key: string;
  label: string;
  scope: EntityScope;
  actorId?: string;
  path: string;
  currentValue?: unknown;
}

const props = defineProps<{
  effects: Effect[];
  targets: EffectTargetOption[];
}>();

const emit = defineEmits<{
  change: [];
  remove: [effectId: string];
}>();

const operations: Effect["op"][] = ["set", "inc", "dec", "append", "remove", "toggle"];

function getTargetKey(effect: Effect): string {
  return [effect.target.scope, effect.target.actorId ?? "", effect.target.path].join("|");
}

function updateTarget(effect: Effect, key: string) {
  const target = props.targets.find((item) => item.key === key);

  if (!target) {
    return;
  }

  effect.target = {
    scope: target.scope,
    actorId: target.scope === "npc" ? target.actorId : undefined,
    path: target.path
  };
  emit("change");
}

function updateValue(effect: Effect, value: string) {
  effect.value = parseValue(value);
  emit("change");
}

function formatValue(value: Effect["value"]): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatCurrentValue(effect: Effect): string {
  const target = props.targets.find((item) => item.key === getTargetKey(effect));

  if (!target) {
    return "目标未在前置数据中出现";
  }
  if (target.currentValue === undefined) {
    return "当前值为空";
  }
  if (typeof target.currentValue === "object") {
    return JSON.stringify(target.currentValue);
  }
  return String(target.currentValue);
}

function parseValue(value: string): Effect["value"] {
  const trimmed = value.trim();

  if (trimmed === "") {
    return "";
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}
</script>

<template>
  <div class="effect-list">
    <p v-if="!targets.length" class="empty-hint">请先在开始节点添加可变更的人物和属性。</p>

    <article
      v-for="effect in effects"
      :key="effect.id"
      class="effect-card"
      :class="{ invalid: !targets.some((target) => target.key === getTargetKey(effect)) }"
    >
      <label>
        目标
        <select :value="getTargetKey(effect)" @change="updateTarget(effect, ($event.target as HTMLSelectElement).value)">
          <option value="" disabled>选择已出现的人物或属性</option>
          <option v-for="target in targets" :key="target.key" :value="target.key">
            {{ target.label }}
          </option>
        </select>
      </label>

      <div class="effect-fields">
        <label>
          操作
          <select v-model="effect.op" @change="emit('change')">
            <option v-for="op in operations" :key="op" :value="op">{{ op }}</option>
          </select>
        </label>

        <label>
          值
          <input :value="formatValue(effect.value)" type="text" placeholder="true / 1 / 文本 / JSON" @input="updateValue(effect, ($event.target as HTMLInputElement).value)" />
        </label>
      </div>

      <small>{{ formatCurrentValue(effect) }}</small>

      <button type="button" class="danger" @click="emit('remove', effect.id)">删除</button>
    </article>
  </div>
</template>

<style scoped>
.effect-list {
  display: grid;
  gap: 10px;
}

.effect-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: grid;
  gap: 8px;
  padding: 10px;
}

.effect-card.invalid {
  border-color: #fecaca;
}

.effect-fields {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(96px, 0.8fr) minmax(0, 1.6fr);
}

label {
  color: #334155;
  display: grid;
  font-size: 12px;
  font-weight: 700;
  gap: 6px;
}

input,
select {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #172033;
  font: inherit;
  font-size: 13px;
  min-width: 0;
  padding: 8px;
  width: 100%;
}

small,
.empty-hint {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.empty-hint {
  margin: 0;
}

button {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #334155;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  padding: 7px 10px;
}

.danger {
  border-color: #fecaca;
  color: #b91c1c;
}

.danger:hover {
  border-color: #ef4444;
  color: #991b1b;
}
</style>
