<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useAiStore, type TextGenerationInput } from "../../stores/aiStore";

const props = defineProps<{
  open: boolean;
  title: string;
  mode: NonNullable<TextGenerationInput["mode"]>;
  initialPrompt?: string;
  context?: string;
  applyLabel?: string;
  allowApply?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  apply: [text: string];
}>();

const aiStore = useAiStore();
const prompt = ref("");
const result = ref("");

const canGenerate = computed(() => Boolean(prompt.value.trim()) && !aiStore.generating);
const canApply = computed(() => Boolean(result.value.trim()) && props.allowApply !== false);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    prompt.value = props.initialPrompt ?? "";
    result.value = "";
    aiStore.lastError = "";
  }
);

async function generate() {
  if (!prompt.value.trim()) return;

  const text = await aiStore.generateText({
    prompt: prompt.value,
    context: props.context,
    mode: props.mode
  });

  if (text) {
    result.value = text;
  }
}

function applyResult() {
  if (!result.value.trim()) return;
  emit("apply", result.value);
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <section class="modal" role="dialog" aria-modal="true" :aria-label="title">
      <header>
        <div>
          <h2>{{ title }}</h2>
          <p>{{ aiStore.model ? `当前模型：${aiStore.model}` : "请先在顶部完成 AI 配置。" }}</p>
        </div>
        <button type="button" class="ghost-button" @click="emit('close')">关闭</button>
      </header>

      <label>
        提示词
        <textarea
          v-model="prompt"
          rows="7"
          placeholder="写下你想生成的剧情、对话、背景设定或风格要求。"
        />
      </label>

      <label v-if="context" class="context-field">
        上下文
        <textarea :value="context" rows="6" readonly />
      </label>

      <div class="result-header">
        <h3>生成结果</h3>
        <button type="button" class="primary" :disabled="!canGenerate" @click="generate">
          {{ aiStore.generating ? "生成中..." : "生成" }}
        </button>
      </div>

      <textarea
        v-model="result"
        class="result-editor"
        rows="8"
        placeholder="生成结果会出现在这里，也可以手动修改后再填入节点。"
      />

      <p v-if="aiStore.lastError" class="error-text">{{ aiStore.lastError }}</p>

      <footer>
        <button type="button" @click="emit('close')">取消</button>
        <button type="button" class="primary" :disabled="!canApply" @click="applyResult">
          {{ applyLabel ?? "应用结果" }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.modal-backdrop {
  align-items: center;
  background: rgba(15, 23, 42, 0.32);
  display: grid;
  inset: 0;
  justify-items: center;
  padding: 24px;
  position: fixed;
  z-index: 40;
}

.modal {
  background: #ffffff;
  border: 1px solid #d9e1ec;
  border-radius: 8px;
  box-shadow: 0 22px 60px rgba(15, 23, 42, 0.24);
  display: grid;
  gap: 14px;
  max-height: calc(100vh - 48px);
  overflow: auto;
  padding: 18px;
  width: min(100%, 720px);
}

header,
footer,
.result-header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

h2,
h3,
p {
  margin: 0;
}

h2 {
  color: #172033;
  font-size: 18px;
}

h3 {
  color: #172033;
  font-size: 14px;
}

p {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

label {
  color: #334155;
  display: grid;
  font-size: 12px;
  font-weight: 700;
  gap: 6px;
}

textarea {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #172033;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  padding: 9px 10px;
  resize: vertical;
}

.context-field textarea {
  background: #f8fafc;
  color: #475569;
}

.result-editor {
  min-height: 180px;
}

.ghost-button {
  background: #f8fafc;
}

.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.primary:hover:not(:disabled) {
  background: #1d4ed8;
  color: #ffffff;
}

.error-text {
  background: #fff1f1;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #b91c1c;
  padding: 8px;
}
</style>
