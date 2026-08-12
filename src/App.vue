<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AiConfigModal from "@/components/editor/AiConfigModal.vue";
import AiTextGeneratorModal from "@/components/editor/AiTextGeneratorModal.vue";
import NodeCanvas from "@/components/editor/NodeCanvas.vue";
import NodePalette from "@/components/editor/NodePalette.vue";
import InspectorPanel from "@/components/editor/InspectorPanel.vue";
import NewProjectModal from "@/components/editor/NewProjectModal.vue";
import RuntimePreview from "@/components/editor/RuntimePreview.vue";
import { createBlankProject } from "@/data/blankProject";
import type { BlankProjectOptions } from "@/data/blankProject";
import { createSampleProject } from "@/data/sampleProject";
import { exportMarkdown } from "@/io/exportMarkdown";
import { exportProjectJson, importProjectJson } from "@/io/projectFile";
import {
  clearProjectDraft,
  loadProjectDraft,
  saveProjectDraft
} from "@/io/projectDraftStorage";
import { useProjectStore } from "@/stores/projectStore";
import { useRuntimeStore } from "@/stores/runtimeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkflowStore } from "@/stores/workflowStore";

const projectStore = useProjectStore();
const runtimeStore = useRuntimeStore();
const settingsStore = useSettingsStore();
const workflowStore = useWorkflowStore();

const projectTitle = computed(() => projectStore.project?.meta.title ?? "未命名项目");
const canRun = computed(() => Boolean(projectStore.project));
const projectSaveState = computed(() => {
  if (!projectStore.project) {
    return "未载入项目";
  }

  return projectStore.dirty ? "未保存" : "已保存";
});
const saveStatus = ref("");
let autosaveTimer: number | null = null;
const isPaletteOpen = ref(false);
const isInspectorOpen = ref(false);
const isRuntimePreviewOpen = ref(false);
const isAiConfigOpen = ref(false);
const isBackgroundGeneratorOpen = ref(false);
const isNewProjectOpen = ref(false);
const hasSelection = computed(() => Boolean(workflowStore.selectedNodeId || workflowStore.selectedEdgeId));
const showInspector = computed(() => hasSelection.value && isInspectorOpen.value);
const workspaceClass = computed(() => ({
  "has-palette": isPaletteOpen.value,
  "has-inspector": showInspector.value,
  "has-runtime": isRuntimePreviewOpen.value
}));

watch(hasSelection, (selected) => {
  isInspectorOpen.value = selected;
});

watch(
  () => settingsStore.autosaveEnabled,
  () => {
    configureAutosave();
  }
);

watch(
  () => settingsStore.autosaveIntervalMs,
  () => {
    configureAutosave();
  }
);

onMounted(() => {
  settingsStore.loadFromStorage();

  const draft = loadProjectDraft();
  if (draft.ok) {
    projectStore.loadProject(draft.draft.project);
    projectStore.lastSavedAt = draft.draft.savedAt;
    saveStatus.value = `已载入本地草稿：${formatTime(draft.draft.savedAt)}`;
  } else {
    saveStatus.value = "可新建项目，或载入示例用于调试。";
  }

  configureAutosave();
});

onBeforeUnmount(() => {
  if (autosaveTimer !== null) {
    window.clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
});

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  if (!projectStore.project) return;
  downloadFile(`${projectStore.project.meta.title}.rpgstory.json`, exportProjectJson(projectStore.project), "application/json");
}

function exportMd() {
  if (!projectStore.project) return;
  downloadFile("mark.md", exportMarkdown(projectStore.project), "text/markdown;charset=utf-8");
}

async function importJson(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const text = await file.text();
  const result = importProjectJson(text);
  if (result.ok) {
    projectStore.loadProject(result.project);
    runtimeStore.stop();
    workflowStore.selectNode(null);
    isRuntimePreviewOpen.value = false;
    saveStatus.value = "已导入项目，可保存为本地草稿。";
  } else {
    projectStore.setValidationErrors(result.errors);
    saveStatus.value = "导入失败。";
  }
  input.value = "";
}

function closeTransientPanels() {
  runtimeStore.stop();
  workflowStore.selectNode(null);
  workflowStore.selectEdge(null);
  isInspectorOpen.value = false;
  isRuntimePreviewOpen.value = false;
}

function newProject(options: BlankProjectOptions) {
  projectStore.loadProject(createBlankProject(options));
  projectStore.markDirty();
  closeTransientPanels();
  isNewProjectOpen.value = false;
  saveStatus.value = `已创建项目「${options.title}」，记得保存草稿。`;
}

function loadSampleProject() {
  projectStore.loadProject(createSampleProject());
  closeTransientPanels();
  saveStatus.value = "已载入示例项目，可用于调试功能。";
}

function saveCurrentDraft(silent = false) {
  if (!projectStore.project) {
    saveStatus.value = "没有可保存的项目。";
    return;
  }

  const draft = saveProjectDraft(projectStore.project);
  if (!draft) {
    saveStatus.value = "当前环境不支持本地保存。";
    return;
  }

  projectStore.markSaved();
  projectStore.lastSavedAt = draft.savedAt;
  if (!silent) {
    saveStatus.value = `已保存草稿：${formatTime(draft.savedAt)}`;
  }
}

function loadSavedDraft() {
  const draft = loadProjectDraft();

  if (!draft.ok) {
    saveStatus.value = draft.error;
    return;
  }

  projectStore.loadProject(draft.draft.project);
  projectStore.lastSavedAt = draft.draft.savedAt;
  closeTransientPanels();
  saveStatus.value = `已载入本地草稿：${formatTime(draft.draft.savedAt)}`;
}

function clearSavedDraft() {
  clearProjectDraft();
  saveStatus.value = "已清除本地草稿，当前画布内容仍保留。";
}

function configureAutosave() {
  if (autosaveTimer !== null) {
    window.clearInterval(autosaveTimer);
    autosaveTimer = null;
  }

  if (!settingsStore.autosaveEnabled) {
    return;
  }

  autosaveTimer = window.setInterval(() => {
    if (projectStore.project && projectStore.dirty) {
      saveCurrentDraft(true);
      saveStatus.value = `已自动保存：${formatTime(projectStore.lastSavedAt)}`;
    }
  }, Math.max(5000, settingsStore.autosaveIntervalMs));
}

function runProject() {
  if (!projectStore.project) return;
  runtimeStore.start(projectStore.project);
  isRuntimePreviewOpen.value = true;
}

function toggleInspector() {
  if (!hasSelection.value) return;
  isInspectorOpen.value = !isInspectorOpen.value;
}

const backgroundPrompt = computed(() =>
  [
    `项目：${projectStore.project?.meta.title ?? "未命名项目"}`,
    `世界观：${projectStore.project?.world.premise ?? ""}`,
    `叙事基调：${projectStore.project?.world.tone ?? ""}`,
    "请扩写一段可作为玩家开场认知的背景故事。"
  ].join("\n")
);

function formatTime(value: string | null) {
  if (!value) {
    return "尚未保存";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Visual Story Editor</p>
        <h1>{{ projectTitle }}</h1>
        <p class="project-status">
          <span>{{ projectSaveState }}</span>
          <span>{{ saveStatus || `上次保存：${formatTime(projectStore.lastSavedAt)}` }}</span>
        </p>
      </div>
      <div class="topbar-actions">
        <button type="button" @click="isNewProjectOpen = true">新建</button>
        <button type="button" :disabled="!projectStore.project" @click="saveCurrentDraft()">保存草稿</button>
        <button type="button" @click="loadSavedDraft">载入草稿</button>
        <button type="button" @click="clearSavedDraft">清除草稿</button>
        <button type="button" @click="isAiConfigOpen = true">AI 配置</button>
        <button type="button" @click="isBackgroundGeneratorOpen = true">AI 背景故事</button>
        <label class="file-button">
          导入
          <input type="file" accept=".json,.rpgstory.json,application/json" @change="importJson" />
        </label>
        <button type="button" :disabled="!projectStore.project" @click="exportJson">导出 JSON</button>
        <button type="button" :disabled="!projectStore.project" @click="exportMd">导出 mark.md</button>
        <button type="button" @click="loadSampleProject">载入示例</button>
        <button type="button" :disabled="!canRun" @click="runProject">运行</button>
      </div>
    </header>

    <section v-if="projectStore.validationErrors.length" class="validation-strip">
      <strong>校验提示</strong>
      <span v-for="error in projectStore.validationErrors" :key="error">{{ error }}</span>
    </section>

    <section class="workspace" :class="workspaceClass">
      <NodePalette v-if="isPaletteOpen" class="workspace-palette" />

      <div class="canvas-frame">
        <div class="canvas-toolbar">
          <button
            type="button"
            class="toggle-button"
            :class="{ active: isPaletteOpen }"
            @click="isPaletteOpen = !isPaletteOpen"
          >
            {{ isPaletteOpen ? "收起节点库" : "节点库" }}
          </button>
        </div>

        <div class="canvas-toolbar right">
          <button
            type="button"
            class="toggle-button"
            :class="{ active: showInspector }"
            :disabled="!hasSelection"
            @click="toggleInspector"
          >
            {{ showInspector ? "收起属性" : "属性" }}
          </button>
          <button
            type="button"
            class="toggle-button"
            :class="{ active: isRuntimePreviewOpen }"
            @click="isRuntimePreviewOpen = !isRuntimePreviewOpen"
          >
            {{ isRuntimePreviewOpen ? "收起预览" : "运行预览" }}
          </button>
        </div>

        <NodeCanvas />
      </div>

      <InspectorPanel v-if="showInspector" class="workspace-inspector" />
      <RuntimePreview v-if="isRuntimePreviewOpen" class="workspace-runtime" />
    </section>

    <NewProjectModal :open="isNewProjectOpen" @create="newProject" @close="isNewProjectOpen = false" />
    <AiConfigModal :open="isAiConfigOpen" @close="isAiConfigOpen = false" />
    <AiTextGeneratorModal
      :open="isBackgroundGeneratorOpen"
      title="AI 背景故事生成"
      mode="background"
      :initial-prompt="backgroundPrompt"
      apply-label="保留在弹窗中"
      :allow-apply="false"
      @close="isBackgroundGeneratorOpen = false"
    />
  </main>
</template>
