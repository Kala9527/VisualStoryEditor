<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type { BlankProjectOptions } from "../../data/blankProject";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  create: [options: BlankProjectOptions];
}>();

const form = reactive({
  title: "",
  premise: "",
  tone: ""
});

const canCreate = computed(() => form.title.trim().length > 0);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }

    form.title = "";
    form.premise = "";
    form.tone = "";
  }
);

function createProject() {
  if (!canCreate.value) {
    return;
  }

  emit("create", {
    title: form.title.trim(),
    premise: form.premise.trim(),
    tone: form.tone.trim()
  });
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <section class="modal" role="dialog" aria-modal="true" aria-label="新建项目">
      <header>
        <div>
          <h2>新建项目</h2>
          <p>输入项目名称后创建一个空白剧情工作流。</p>
        </div>
        <button type="button" class="ghost-button" @click="emit('close')">关闭</button>
      </header>

      <div class="form-grid">
        <label>
          项目名称
          <input v-model="form.title" type="text" autocomplete="off" placeholder="例如 雾港外传" @keydown.enter="createProject" />
        </label>

        <label>
          世界观
          <textarea v-model="form.premise" rows="3" placeholder="可选，后续也能继续编辑。" />
        </label>

        <label>
          叙事风格
          <input v-model="form.tone" type="text" placeholder="可选，例如 悬疑、黑暗奇幻、轻喜剧" />
        </label>
      </div>

      <footer>
        <button type="button" @click="emit('close')">取消</button>
        <button type="button" class="primary" :disabled="!canCreate" @click="createProject">创建项目</button>
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

input,
textarea {
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

.primary:hover:not(:disabled) {
  background: #1d4ed8;
  color: #ffffff;
}
</style>
