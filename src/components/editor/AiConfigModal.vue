<script setup lang="ts">
import { reactive, watch } from "vue";
import { useAiStore } from "../../stores/aiStore";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const aiStore = useAiStore();
const form = reactive({
  baseUrl: aiStore.baseUrl,
  apiKey: aiStore.apiKey,
  model: aiStore.model,
  temperature: aiStore.temperature
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.baseUrl = aiStore.baseUrl;
    form.apiKey = aiStore.apiKey;
    form.model = aiStore.model;
    form.temperature = aiStore.temperature;
  }
);

function save() {
  aiStore.updateConfig({
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey.trim(),
    model: form.model.trim(),
    temperature: Number(form.temperature)
  });
  emit("close");
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <section class="modal" role="dialog" aria-modal="true" aria-label="AI 配置">
      <header>
        <div>
          <h2>AI 配置</h2>
          <p>OpenAI 兼容接口，配置会保存在本机浏览器 localStorage。</p>
        </div>
        <button type="button" class="ghost-button" @click="emit('close')">关闭</button>
      </header>

      <div class="form-grid">
        <label>
          API Base URL
          <input v-model="form.baseUrl" type="url" placeholder="https://api.openai.com/v1" />
        </label>

        <label>
          API Key
          <input v-model="form.apiKey" type="password" autocomplete="off" placeholder="sk-..." />
        </label>

        <label>
          模型
          <input v-model="form.model" type="text" placeholder="gpt-4o-mini" />
        </label>

        <label>
          温度
          <input v-model.number="form.temperature" type="number" min="0" max="2" step="0.1" />
        </label>
      </div>

      <footer>
        <button type="button" @click="emit('close')">取消</button>
        <button type="button" class="primary" @click="save">保存配置</button>
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
  gap: 18px;
  max-width: 560px;
  padding: 18px;
  width: min(100%, 560px);
}

header,
footer {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
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
  line-height: 1.5;
}

.form-grid {
  display: grid;
  gap: 12px;
}

label {
  color: #334155;
  display: grid;
  font-size: 12px;
  font-weight: 700;
  gap: 6px;
}

input {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #172033;
  font: inherit;
  font-size: 13px;
  padding: 9px 10px;
}

.ghost-button {
  background: #f8fafc;
}

.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.primary:hover {
  background: #1d4ed8;
  color: #ffffff;
}
</style>
