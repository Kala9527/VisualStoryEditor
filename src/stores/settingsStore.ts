import { defineStore } from "pinia";

export interface EditorSettings {
  autosaveEnabled: boolean;
  autosaveIntervalMs: number;
  markdownIncludeJsonBlocks: boolean;
  markdownIncludeAiNotes: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  compactNodes: boolean;
}

const storageKey = "visual-story-editor:settings";

const defaultSettings = (): EditorSettings => ({
  autosaveEnabled: true,
  autosaveIntervalMs: 30000,
  markdownIncludeJsonBlocks: true,
  markdownIncludeAiNotes: true,
  showGrid: true,
  snapToGrid: false,
  gridSize: 20,
  compactNodes: false
});

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    ...defaultSettings()
  }),

  actions: {
    patchSettings(patch: Partial<EditorSettings>) {
      Object.assign(this, patch);
      this.saveToStorage();
    },

    resetSettings() {
      Object.assign(this, defaultSettings());
      this.saveToStorage();
    },

    loadFromStorage() {
      if (typeof localStorage === "undefined") {
        return;
      }

      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }

      try {
        Object.assign(this, defaultSettings(), JSON.parse(raw));
      } catch {
        localStorage.removeItem(storageKey);
      }
    },

    saveToStorage() {
      if (typeof localStorage === "undefined") {
        return;
      }

      const payload: EditorSettings = {
        autosaveEnabled: this.autosaveEnabled,
        autosaveIntervalMs: this.autosaveIntervalMs,
        markdownIncludeJsonBlocks: this.markdownIncludeJsonBlocks,
        markdownIncludeAiNotes: this.markdownIncludeAiNotes,
        showGrid: this.showGrid,
        snapToGrid: this.snapToGrid,
        gridSize: this.gridSize,
        compactNodes: this.compactNodes
      };

      localStorage.setItem(storageKey, JSON.stringify(payload));
    }
  }
});
