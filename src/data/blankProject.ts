import type { GameProject } from "../domain/types";

export interface BlankProjectOptions {
  title?: string;
  premise?: string;
  tone?: string;
}

const nowIso = () => new Date().toISOString();

export function createBlankProject(options: BlankProjectOptions = {}): GameProject {
  const createdAt = nowIso();

  return {
    schemaVersion: "1.0",
    meta: {
      title: options.title?.trim() || "我的剧情项目",
      author: "",
      description: "",
      createdAt,
      updatedAt: createdAt
    },
    world: {
      premise: options.premise?.trim() || "在这里填写世界观设定。",
      tone: options.tone?.trim() || "在这里填写叙事风格。",
      genre: "",
      themes: [],
      locations: [],
      factions: [],
      loreEntries: []
    },
    attributeDefs: [
      {
        key: "hp",
        label: "生命",
        type: "number",
        min: 0,
        max: 100,
        defaultValue: 100
      },
      {
        key: "courage",
        label: "勇气",
        type: "number",
        min: 0,
        max: 20,
        defaultValue: 5
      }
    ],
    items: [],
    actors: [
      {
        id: "player",
        name: "玩家",
        role: "player",
        summary: "玩家角色。",
        attributes: {
          hp: 100,
          courage: 5
        },
        inventory: [],
        flags: {},
        relations: {},
        tags: ["玩家"]
      }
    ],
    state: {
      playerId: "player",
      global: {
        variables: {
          chapter: 1
        },
        flags: {},
        discoveredLocations: [],
        completedQuests: []
      }
    },
    workflow: {
      startNodeId: "n_start",
      nodes: {
        n_start: {
          id: "n_start",
          type: "start",
          title: "开始",
          position: { x: 0, y: 0 },
          inputPorts: [],
          outputPorts: ["out"]
        },
        n_story_opening: {
          id: "n_story_opening",
          type: "story",
          title: "开场剧情",
          position: { x: 280, y: 0 },
          inputPorts: ["in"],
          outputPorts: ["out"],
          content: "在这里写入第一段剧情、旁白或角色对白。",
          sceneTags: ["开场"]
        },
        n_end_draft: {
          id: "n_end_draft",
          type: "end",
          title: "暂定结局",
          position: { x: 560, y: 0 },
          inputPorts: ["in"],
          outputPorts: [],
          endingId: "ending_draft",
          endingTitle: "暂定结局",
          endingSummary: "这里描述当前分支的结局。"
        }
      },
      edges: [
        {
          id: "e_start_opening",
          from: { nodeId: "n_start", port: "out" },
          to: { nodeId: "n_story_opening", port: "in" }
        },
        {
          id: "e_opening_end",
          from: { nodeId: "n_story_opening", port: "out" },
          to: { nodeId: "n_end_draft", port: "in" }
        }
      ]
    }
  };
}
