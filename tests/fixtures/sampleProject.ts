import type { GameProject } from "../../src/domain/types/project";

export function createSampleProject(): GameProject {
  return {
    schemaVersion: "1.0",
    meta: {
      title: "Fog Harbor",
      author: "test",
      description: "Contract-test project for the RPG story editor.",
      createdAt: "2026-07-23T10:00:00+08:00",
      updatedAt: "2026-07-23T10:00:00+08:00"
    },
    world: {
      premise: "A harbor city is trapped in supernatural fog.",
      tone: "Dark fantasy investigation",
      genre: "dark fantasy",
      themes: ["memory", "cost"],
      locations: [
        {
          id: "loc_harbor",
          name: "Harbor",
          summary: "A ruined harbor covered by fog.",
          tags: ["intro"]
        }
      ],
      factions: [
        {
          id: "fac_watch",
          name: "Night Watch",
          summary: "A neutral force protecting the city.",
          alignment: "neutral"
        }
      ]
    },
    attributeDefs: [
      { key: "hp", label: "HP", type: "number", min: 0, max: 100, defaultValue: 80 },
      { key: "courage", label: "Courage", type: "number", min: 0, max: 20, defaultValue: 8 },
      { key: "trust", label: "Trust", type: "number", min: -100, max: 100, defaultValue: 0 }
    ],
    items: [
      {
        id: "item_silver_key",
        name: "Silver Key",
        type: "quest",
        description: "A broken key fragment tied to the old kingdom.",
        stackable: false,
        tags: ["main"]
      },
      {
        id: "item_potion",
        name: "Potion",
        type: "consumable",
        description: "Restores health.",
        stackable: true,
        maxStack: 9
      }
    ],
    actors: [
      {
        id: "player",
        name: "Player",
        role: "player",
        summary: "An amnesiac mercenary.",
        attributes: {
          hp: 80,
          courage: 8
        },
        inventory: [{ itemId: "item_potion", count: 2 }],
        flags: {
          hasMap: true
        },
        relations: {}
      },
      {
        id: "npc_elena",
        name: "Elena",
        role: "npc",
        summary: "A young investigator from the Night Watch.",
        factionId: "fac_watch",
        locationId: "loc_harbor",
        attributes: {
          hp: 60,
          trust: 5
        },
        inventory: [],
        flags: {
          metPlayer: false
        },
        relations: {
          player: 5
        }
      }
    ],
    state: {
      playerId: "player",
      global: {
        variables: {
          fogLevel: 3
        },
        flags: {
          met_elena: false
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
          title: "Start",
          position: { x: 0, y: 0 },
          inputPorts: [],
          outputPorts: ["out"]
        },
        n_story_wake: {
          id: "n_story_wake",
          type: "story",
          title: "Wake Up",
          position: { x: 240, y: 0 },
          inputPorts: ["in"],
          outputPorts: ["out"],
          content: "You wake on the harbor pier with half a silver key.",
          locationId: "loc_harbor",
          sceneTags: ["intro"]
        },
        n_choice_first: {
          id: "n_choice_first",
          type: "choice",
          title: "First Choice",
          position: { x: 520, y: 0 },
          inputPorts: ["in"],
          outputPorts: ["choice:ask_help", "choice:hide_key"],
          prompt: "Footsteps approach. What do you do?",
          choices: [
            {
              id: "ask_help",
              text: "Ask for help",
              effects: [
                {
                  id: "effect_met_elena",
                  target: { scope: "global", path: "flags.met_elena" },
                  op: "set",
                  value: true,
                  reason: "The player approaches Elena."
                }
              ]
            },
            {
              id: "hide_key",
              text: "Hide the key",
              effects: [
                {
                  id: "effect_courage_up",
                  target: { scope: "player", path: "attributes.courage" },
                  op: "inc",
                  value: 1,
                  reason: "The player acts carefully."
                }
              ]
            }
          ]
        },
        n_end_safe: {
          id: "n_end_safe",
          type: "end",
          title: "Safe Ending",
          position: { x: 820, y: 0 },
          inputPorts: ["in"],
          outputPorts: [],
          endingId: "safe_intro",
          endingTitle: "Safe for Now",
          endingSummary: "The player survives the intro scene."
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
          id: "e_choice_help_end",
          from: { nodeId: "n_choice_first", port: "choice:ask_help" },
          to: { nodeId: "n_end_safe", port: "in" }
        }
      ]
    }
  };
}

export function createRuntimeContext(project = createSampleProject()) {
  return {
    project,
    currentNodeId: project.workflow.startNodeId,
    state: structuredClone(project.state),
    actorsById: Object.fromEntries(project.actors.map((actor) => [actor.id, structuredClone(actor)])),
    itemsById: Object.fromEntries(project.items.map((item) => [item.id, structuredClone(item)])),
    history: []
  };
}
