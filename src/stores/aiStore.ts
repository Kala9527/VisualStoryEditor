import { defineStore } from "pinia";
import type { GameProject, ID } from "../domain/types";
import { chatCompletions, type AiProviderConfig, type ChatMessage } from "../ai/provider";

export interface AiDraft {
  id: ID;
  type: "world" | "actor" | "branch" | "node_patch";
  title: string;
  payload: unknown;
  validationErrors: string[];
  createdAt: string;
  acceptedAt?: string;
}

export interface AiProviderState {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface TextGenerationInput {
  prompt: string;
  context?: string;
  mode?: "background" | "story" | "dialogue";
}

export interface GenerateWorldInput {
  genre: string;
  tone: string;
  mustInclude?: string;
  avoid?: string;
}

export interface GenerateActorInput {
  worldSummary: string;
  count: number;
}

export interface GenerateBranchesInput {
  project: GameProject;
  currentNodeId: ID;
  branchCount: number;
}

const createId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const AI_CONFIG_STORAGE_KEY = "visual-story-editor.ai-config.v1";
const defaultConfig: AiProviderState = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.8
};

function loadStoredConfig(): AiProviderState {
  if (typeof localStorage === "undefined") {
    return { ...defaultConfig };
  }

  try {
    const stored = JSON.parse(localStorage.getItem(AI_CONFIG_STORAGE_KEY) ?? "{}") as Partial<AiProviderState>;

    return {
      baseUrl: stored.baseUrl || defaultConfig.baseUrl,
      apiKey: stored.apiKey || defaultConfig.apiKey,
      model: stored.model || defaultConfig.model,
      temperature:
        typeof stored.temperature === "number" && Number.isFinite(stored.temperature)
          ? stored.temperature
          : defaultConfig.temperature
    };
  } catch {
    return { ...defaultConfig };
  }
}

function saveStoredConfig(config: AiProviderState): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export const useAiStore = defineStore("ai", {
  state: () => {
    const storedConfig = loadStoredConfig();

    return {
      baseUrl: storedConfig.baseUrl,
      apiKey: storedConfig.apiKey,
      model: storedConfig.model,
      temperature: storedConfig.temperature,
      generating: false,
      lastError: "",
      drafts: [] as AiDraft[]
    };
  },

  getters: {
    config: (state): AiProviderState => ({
      baseUrl: state.baseUrl,
      apiKey: state.apiKey,
      model: state.model,
      temperature: state.temperature
    }),

    pendingDrafts: (state): AiDraft[] => state.drafts.filter((draft) => !draft.acceptedAt)
  },

  actions: {
    updateConfig(patch: Partial<AiProviderState>) {
      this.baseUrl = patch.baseUrl ?? this.baseUrl;
      this.apiKey = patch.apiKey ?? this.apiKey;
      this.model = patch.model ?? this.model;
      this.temperature = patch.temperature ?? this.temperature;
      this.persistConfig();
    },

    persistConfig() {
      saveStoredConfig(this.config);
    },

    assertReadyConfig(): AiProviderConfig {
      if (!this.model.trim()) {
        throw new Error("请先填写 AI 模型。");
      }
      if (!this.apiKey.trim()) {
        throw new Error("请先在顶部 AI 配置中填写 API Key。");
      }

      return {
        baseUrl: this.baseUrl.trim() || defaultConfig.baseUrl,
        apiKey: this.apiKey.trim(),
        model: this.model.trim(),
        temperature: this.temperature
      };
    },

    createDraft(input: Omit<AiDraft, "id" | "createdAt" | "validationErrors"> & { validationErrors?: string[] }) {
      const draft: AiDraft = {
        id: createId("draft"),
        createdAt: new Date().toISOString(),
        validationErrors: input.validationErrors ?? [],
        type: input.type,
        title: input.title,
        payload: input.payload
      };

      this.drafts.unshift(draft);
      return draft;
    },

    async generateWorld(input: GenerateWorldInput) {
      this.generating = true;
      this.lastError = "";

      try {
        const draft = this.createDraft({
          type: "world",
          title: `世界观草稿：${input.genre || "未命名题材"}`,
          payload: {
            request: input,
            status: "pending-provider-integration",
            note: "等待 ai/storyGenerator.ts 接入后替换为真实 Chat Completions 调用。"
          }
        });

        return draft;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        return null;
      } finally {
        this.generating = false;
      }
    },

    async generateActor(input: GenerateActorInput) {
      this.generating = true;
      this.lastError = "";

      try {
        return this.createDraft({
          type: "actor",
          title: `角色草稿：${input.count} 名角色`,
          payload: {
            request: input,
            status: "pending-provider-integration",
            note: "等待 ai/storyGenerator.ts 接入后替换为真实角色生成。"
          }
        });
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        return null;
      } finally {
        this.generating = false;
      }
    },

    async generateBranches(input: GenerateBranchesInput) {
      this.generating = true;
      this.lastError = "";

      try {
        return this.createDraft({
          type: "branch",
          title: `分支草稿：${input.currentNodeId}`,
          payload: {
            currentNodeId: input.currentNodeId,
            branchCount: input.branchCount,
            status: "pending-provider-integration",
            note: "等待 ai/storyGenerator.ts 接入后替换为真实后续分支生成。"
          }
        });
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        return null;
      } finally {
        this.generating = false;
      }
    },

    async generateText(input: TextGenerationInput) {
      this.generating = true;
      this.lastError = "";

      try {
        const messages = buildTextGenerationMessages(input);
        const result = await chatCompletions(this.assertReadyConfig(), messages, {
          temperature: this.temperature,
          maxTokens: 1400,
          timeoutMs: 60000
        });

        return result.content.trim();
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        return null;
      } finally {
        this.generating = false;
      }
    },

    acceptDraft(draftId: ID) {
      const draft = this.drafts.find((entry) => entry.id === draftId);

      if (draft) {
        draft.acceptedAt = new Date().toISOString();
      }
    },

    rejectDraft(draftId: ID) {
      this.drafts = this.drafts.filter((draft) => draft.id !== draftId);
    },

    clearDrafts() {
      this.drafts = [];
    }
  }
});

function buildTextGenerationMessages(input: TextGenerationInput): ChatMessage[] {
  const modeLabel = {
    background: "背景故事",
    story: "剧情正文",
    dialogue: "角色对话"
  }[input.mode ?? "story"];

  return [
    {
      role: "system",
      content: [
        "你是资深 RPG 互动叙事编剧。",
        "请使用简体中文输出可直接放入编辑器的正文。",
        "不要输出 Markdown 标题、JSON、解释说明或方案列表。",
        "保持文本适合节点式剧情系统：信息清楚、可接续、给后续分支留下空间。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `生成类型：${modeLabel}`,
        "",
        input.context ? `上下文：\n${input.context}` : "上下文：无",
        "",
        `用户提示词：\n${input.prompt}`
      ].join("\n")
    }
  ];
}
