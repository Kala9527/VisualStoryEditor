import type { GameProject } from "../domain/types";

const now = "2026-07-23T10:00:00+08:00";

export function createSampleProject(): GameProject {
  return {
    schemaVersion: "1.0",
    meta: {
      title: "雾港的银钥匙",
      author: "team",
      description: "黑暗奇幻调查向 RPG 序章示例项目。",
      createdAt: now,
      updatedAt: now
    },
    world: {
      premise: "海港城市被永恒浓雾覆盖，旧王朝遗物正在苏醒。",
      tone: "黑暗奇幻、调查、低魔",
      genre: "dark fantasy",
      themes: ["失忆", "代价", "旧王朝"],
      locations: [
        {
          id: "loc_harbor",
          name: "雾港码头",
          summary: "被浓雾包围的破旧码头，潮声里夹杂着铃声。",
          tags: ["港口", "序章"]
        },
        {
          id: "loc_watch_house",
          name: "守夜人旧屋",
          summary: "雾港守夜人用来审讯、治疗和存放旧档案的木屋。",
          tags: ["据点", "调查"]
        }
      ],
      factions: [
        {
          id: "fac_watch",
          name: "雾港守夜人",
          summary: "负责在夜间维持秩序的半官方组织。",
          alignment: "neutral"
        },
        {
          id: "fac_old_court",
          name: "旧王廷余党",
          summary: "试图复原旧王朝仪式的隐秘团体。",
          alignment: "hostile"
        }
      ],
      loreEntries: [
        {
          id: "lore_silver_key",
          title: "银钥匙传闻",
          content: "完整的银钥匙可以开启旧王城地下的黑门，但每次使用都会让浓雾更接近活物。"
        }
      ]
    },
    attributeDefs: [
      { key: "hp", label: "生命", type: "number", min: 0, max: 100, defaultValue: 100 },
      { key: "mp", label: "魔力", type: "number", min: 0, max: 100, defaultValue: 30 },
      { key: "strength", label: "力量", type: "number", min: 0, max: 20, defaultValue: 5 },
      { key: "intelligence", label: "智力", type: "number", min: 0, max: 20, defaultValue: 5 },
      { key: "charisma", label: "魅力", type: "number", min: 0, max: 20, defaultValue: 5 },
      { key: "courage", label: "勇气", type: "number", min: 0, max: 20, defaultValue: 5 },
      { key: "morality", label: "道德", type: "number", min: -100, max: 100, defaultValue: 0 }
    ],
    items: [
      {
        id: "item_silver_key",
        name: "半枚银钥匙",
        type: "quest",
        description: "能开启旧王城地下门的钥匙残片。",
        stackable: false,
        tags: ["主线", "旧王朝"]
      },
      {
        id: "item_fog_potion",
        name: "醒雾药剂",
        type: "consumable",
        description: "守夜人配制的苦涩药剂，可暂时抵抗浓雾侵蚀。",
        stackable: true,
        maxStack: 9,
        attributes: { resistFog: 1 },
        tags: ["治疗", "雾"]
      }
    ],
    actors: [
      {
        id: "player",
        name: "主角",
        role: "player",
        summary: "在码头醒来的失忆佣兵，只记得自己必须找到完整的银钥匙。",
        biography: "数日前受雇护送一只封蜡木匣进入雾港，醒来时任务、雇主和同伴都已消失。",
        locationId: "loc_harbor",
        attributes: {
          hp: 80,
          mp: 20,
          strength: 8,
          intelligence: 7,
          charisma: 6,
          courage: 8,
          morality: 0
        },
        inventory: [{ itemId: "item_silver_key", count: 1 }],
        flags: { remembers_contract: false },
        relations: {},
        tags: ["玩家", "失忆"]
      },
      {
        id: "npc_elena",
        name: "Elena",
        role: "npc",
        summary: "守夜人的年轻调查员，正在追查码头失踪案。",
        biography: "她的导师曾研究旧王朝遗物，并在三个月前消失于浓雾深处。",
        factionId: "fac_watch",
        locationId: "loc_harbor",
        attributes: {
          hp: 60,
          mp: 35,
          strength: 4,
          intelligence: 12,
          charisma: 9,
          courage: 12,
          morality: 20
        },
        inventory: [{ itemId: "item_fog_potion", count: 2 }],
        flags: { met_player: false },
        relations: { player: 0 },
        tags: ["关键 NPC", "调查员"],
        aiNotes: "适合承载交涉、信任与情报路线。"
      },
      {
        id: "enemy_fog_hound",
        name: "雾犬",
        role: "enemy",
        summary: "被浓雾扭曲的猎犬，会追逐银器的气味。",
        factionId: "fac_old_court",
        locationId: "loc_harbor",
        attributes: {
          hp: 45,
          mp: 0,
          strength: 10,
          intelligence: 2,
          charisma: 0,
          courage: 14,
          morality: -40
        },
        inventory: [],
        flags: {},
        relations: { player: -30 },
        tags: ["敌人", "野兽", "雾"]
      }
    ],
    state: {
      playerId: "player",
      global: {
        variables: {
          fogLevel: 3,
          chapter: 1
        },
        flags: {
          met_elena: false,
          silver_key_seen: true,
          fog_hound_defeated: false
        },
        discoveredLocations: ["loc_harbor"],
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
        n_story_wake: {
          id: "n_story_wake",
          type: "story",
          title: "码头醒来",
          position: { x: 240, y: 0 },
          inputPorts: ["in"],
          outputPorts: ["out"],
          content: "你在雾港码头醒来，手里攥着半枚冰冷的银钥匙。潮水拍击木桩，远处有脚步声穿过浓雾。",
          locationId: "loc_harbor",
          sceneTags: ["序章", "醒来"]
        },
        n_choice_first: {
          id: "n_choice_first",
          type: "choice",
          title: "第一个选择",
          position: { x: 520, y: 0 },
          inputPorts: ["in"],
          outputPorts: ["choice:ask_help", "choice:hide_key", "choice:force_escape"],
          prompt: "脚步声越来越近。你要怎么做？",
          choices: [
            {
              id: "ask_help",
              text: "向来人求助",
              effects: [
                {
                  id: "effect_met_elena",
                  target: { scope: "global", path: "flags.met_elena" },
                  op: "set",
                  value: true,
                  reason: "玩家主动接触 Elena"
                },
                {
                  id: "effect_relation_elena_up",
                  target: { scope: "npc", actorId: "npc_elena", path: "relations.player" },
                  op: "inc",
                  value: 5,
                  reason: "玩家选择信任 Elena"
                }
              ]
            },
            {
              id: "hide_key",
              text: "藏起银钥匙并观察",
              effects: [
                {
                  id: "effect_courage_up",
                  target: { scope: "player", path: "attributes.courage" },
                  op: "inc",
                  value: 1,
                  reason: "玩家谨慎行动"
                }
              ]
            },
            {
              id: "force_escape",
              text: "强行冲出浓雾",
              enabledWhen: [
                {
                  id: "cond_hp_enough_to_escape",
                  label: "生命值足以承受浓雾",
                  expression: "player.attributes.hp > 30"
                }
              ],
              effects: [
                {
                  id: "effect_fog_damage_escape",
                  target: { scope: "player", path: "attributes.hp" },
                  op: "dec",
                  value: 12,
                  reason: "强行穿越浓雾受到伤害"
                }
              ]
            }
          ]
        },
        n_mutation_elena_intro: {
          id: "n_mutation_elena_intro",
          type: "mutation",
          title: "记录 Elena 相遇",
          position: { x: 820, y: -180 },
          inputPorts: ["in"],
          outputPorts: ["out"],
          effects: [
            {
              id: "effect_elena_flag_met_player",
              target: { scope: "npc", actorId: "npc_elena", path: "flags.met_player" },
              op: "set",
              value: true,
              reason: "Elena 已与玩家正式接触"
            }
          ]
        },
        n_story_elena: {
          id: "n_story_elena",
          type: "story",
          title: "守夜人的提灯",
          position: { x: 1100, y: -180 },
          inputPorts: ["in"],
          outputPorts: ["out"],
          content: "提灯后的女子压低声音：别把钥匙举起来，雾里的东西会闻见银器。她自称 Elena，是守夜人的调查员。",
          speakerId: "npc_elena",
          locationId: "loc_harbor",
          sceneTags: ["相遇", "情报"]
        },
        n_condition_key_visible: {
          id: "n_condition_key_visible",
          type: "condition",
          title: "是否暴露银钥匙",
          position: { x: 820, y: 40 },
          inputPorts: ["in"],
          outputPorts: ["seen", "hidden"],
          branches: [
            {
              port: "seen",
              label: "钥匙仍被看见",
              condition: {
                id: "cond_silver_key_seen",
                label: "银钥匙已暴露",
                expression: "global.flags.silver_key_seen == true"
              }
            }
          ],
          fallbackPort: "hidden"
        },
        n_random_fog: {
          id: "n_random_fog",
          type: "random",
          title: "浓雾反应",
          position: { x: 1100, y: 40 },
          inputPorts: ["in"],
          outputPorts: ["hound", "quiet"],
          branches: [
            { port: "hound", label: "雾犬被吸引", weight: 70 },
            { port: "quiet", label: "雾暂时沉寂", weight: 30 }
          ],
          seedKey: "intro_fog_reaction"
        },
        n_combat_hound: {
          id: "n_combat_hound",
          type: "combat",
          title: "雾犬袭击",
          position: { x: 1400, y: -40 },
          inputPorts: ["in"],
          outputPorts: ["win", "lose", "escape", "dead"],
          enemies: [{ actorId: "enemy_fog_hound", level: 1 }],
          escapeAllowed: true,
          winEffects: [
            {
              id: "effect_hound_defeated",
              target: { scope: "global", path: "flags.fog_hound_defeated" },
              op: "set",
              value: true,
              reason: "玩家击退雾犬"
            }
          ],
          loseEffects: [
            {
              id: "effect_hound_bite",
              target: { scope: "player", path: "attributes.hp" },
              op: "dec",
              value: 20,
              reason: "雾犬咬伤玩家"
            }
          ],
          escapeEffects: [
            {
              id: "effect_escape_fog_level",
              target: { scope: "global", path: "variables.fogLevel" },
              op: "inc",
              value: 1,
              reason: "逃跑惊动浓雾"
            }
          ]
        },
        n_story_hidden: {
          id: "n_story_hidden",
          type: "story",
          title: "暗处观察",
          position: { x: 1100, y: 260 },
          inputPorts: ["in"],
          outputPorts: ["out"],
          content: "你屏住呼吸躲进货箱阴影。脚步声停在不远处，对方似乎正在检查码头上的血迹。",
          locationId: "loc_harbor",
          sceneTags: ["潜行", "调查"]
        },
        n_story_safe: {
          id: "n_story_safe",
          type: "story",
          title: "雾暂时退去",
          position: { x: 1400, y: 220 },
          inputPorts: ["in"],
          outputPorts: ["out"],
          content: "浓雾像被无形的手拨开，露出通往守夜人旧屋的石阶。这里暂时安全。",
          locationId: "loc_harbor",
          sceneTags: ["缓和", "转场"]
        },
        n_end_watch_house: {
          id: "n_end_watch_house",
          type: "end",
          title: "序章结束：旧屋灯火",
          position: { x: 1700, y: 80 },
          inputPorts: ["in"],
          outputPorts: [],
          endingId: "ending_watch_house",
          endingTitle: "旧屋灯火",
          endingSummary: "玩家暂时脱离码头危险，下一幕将在守夜人旧屋展开。"
        },
        n_end_fog_defeat: {
          id: "n_end_fog_defeat",
          type: "end",
          title: "结局：雾中倒下",
          position: { x: 1700, y: -160 },
          inputPorts: ["in"],
          outputPorts: [],
          endingId: "ending_fog_defeat",
          endingTitle: "雾中倒下",
          endingSummary: "雾犬拖慢了玩家的脚步，银钥匙的线索暂时断在浓雾里。"
        }
      },
      edges: [
        {
          id: "e_start_wake",
          from: { nodeId: "n_start", port: "out" },
          to: { nodeId: "n_story_wake", port: "in" }
        },
        {
          id: "e_wake_choice",
          from: { nodeId: "n_story_wake", port: "out" },
          to: { nodeId: "n_choice_first", port: "in" }
        },
        {
          id: "e_choice_help_mutation",
          from: { nodeId: "n_choice_first", port: "choice:ask_help" },
          to: { nodeId: "n_mutation_elena_intro", port: "in" }
        },
        {
          id: "e_mutation_elena_story",
          from: { nodeId: "n_mutation_elena_intro", port: "out" },
          to: { nodeId: "n_story_elena", port: "in" }
        },
        {
          id: "e_story_elena_safe",
          from: { nodeId: "n_story_elena", port: "out" },
          to: { nodeId: "n_story_safe", port: "in" }
        },
        {
          id: "e_choice_hide_condition",
          from: { nodeId: "n_choice_first", port: "choice:hide_key" },
          to: { nodeId: "n_condition_key_visible", port: "in" }
        },
        {
          id: "e_condition_seen_random",
          from: { nodeId: "n_condition_key_visible", port: "seen" },
          to: { nodeId: "n_random_fog", port: "in" }
        },
        {
          id: "e_condition_hidden_story",
          from: { nodeId: "n_condition_key_visible", port: "hidden" },
          to: { nodeId: "n_story_hidden", port: "in" }
        },
        {
          id: "e_random_hound_combat",
          from: { nodeId: "n_random_fog", port: "hound" },
          to: { nodeId: "n_combat_hound", port: "in" }
        },
        {
          id: "e_random_quiet_safe",
          from: { nodeId: "n_random_fog", port: "quiet" },
          to: { nodeId: "n_story_safe", port: "in" }
        },
        {
          id: "e_choice_escape_combat",
          from: { nodeId: "n_choice_first", port: "choice:force_escape" },
          to: { nodeId: "n_combat_hound", port: "in" },
          guard: {
            id: "guard_escape_hp",
            label: "逃跑前仍有足够生命",
            expression: "player.attributes.hp > 0"
          }
        },
        {
          id: "e_combat_win_safe",
          from: { nodeId: "n_combat_hound", port: "win" },
          to: { nodeId: "n_story_safe", port: "in" }
        },
        {
          id: "e_combat_lose_defeat",
          from: { nodeId: "n_combat_hound", port: "lose" },
          to: { nodeId: "n_end_fog_defeat", port: "in" }
        },
        {
          id: "e_combat_escape_safe",
          from: { nodeId: "n_combat_hound", port: "escape" },
          to: { nodeId: "n_story_safe", port: "in" }
        },
        {
          id: "e_combat_dead_defeat",
          from: { nodeId: "n_combat_hound", port: "dead" },
          to: { nodeId: "n_end_fog_defeat", port: "in" }
        },
        {
          id: "e_hidden_safe",
          from: { nodeId: "n_story_hidden", port: "out" },
          to: { nodeId: "n_story_safe", port: "in" }
        },
        {
          id: "e_safe_end",
          from: { nodeId: "n_story_safe", port: "out" },
          to: { nodeId: "n_end_watch_house", port: "in" }
        }
      ]
    }
  };
}
