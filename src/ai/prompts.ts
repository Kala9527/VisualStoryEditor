import type { ChatMessage } from "./provider";
import type {
  GenerateActorsInput,
  GenerateBranchesInput,
  GenerateWorldInput
} from "./schemas";

const DEFAULT_LANGUAGE = "简体中文";

export function buildGenerateWorldMessages(input: GenerateWorldInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是资深 RPG 世界观与任务线设计师。",
        "必须只输出符合 JSON Schema 的 JSON 对象，不要输出 Markdown 或额外解释。",
        "世界观需要适合节点式剧情系统拆分，地点、阵营、主线冲突和可变状态必须清晰。",
        "物品应优先包含能推动剧情分支的任务物品或关键道具。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "请生成一个 RPG 故事背景草稿。",
        "",
        `输出语言：${input.language ?? DEFAULT_LANGUAGE}`,
        `题材：${input.genre ?? "由你根据需求设计"}`,
        `叙事基调：${input.tone ?? "克制、清晰、适合分支剧情"}`,
        `目标游玩时长：${input.playtime ?? "30 分钟序章"}`,
        `初始创意：${input.premiseHint ?? "暂无，允许原创"}`,
        `必须包含：${formatList(input.mustInclude)}`,
        `避免：${formatList(input.avoid)}`,
        "",
        "输出字段要求：",
        "- world：包含 premise、tone、genre、themes、locations、factions、loreEntries。",
        "- items：至少 1 个剧情关键物品。",
        "- suggestedGlobalState：包含 variables、flags、discoveredLocations。",
        "- summary：一句话概括这个世界观的可玩冲突。"
      ].join("\n")
    }
  ];
}

export function buildGenerateActorsMessages(input: GenerateActorsInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是 RPG 角色与数值系统设计师。",
        "必须只输出符合 JSON Schema 的 JSON 对象，不要输出 Markdown 或额外解释。",
        "所有角色属性必须使用给定 attributeDefs 中存在的 key。",
        "NPC 关系值范围为 -100 到 100。角色要能服务于剧情分支、状态变更与后续战斗或交涉。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "请基于当前世界观生成角色与初始数值草稿。",
        "",
        `输出语言：${input.language ?? DEFAULT_LANGUAGE}`,
        "世界观摘要：",
        input.worldSummary,
        "",
        "属性定义：",
        stringifyForPrompt(input.attributeDefs),
        "",
        "物品上下文：",
        stringifyForPrompt(input.itemContext ?? []),
        "",
        "已有角色：",
        stringifyForPrompt(input.existingActors ?? []),
        "",
        `角色需求：${formatList(input.actorRequirements)}`,
        "",
        "默认生成建议：",
        "- 1 名玩家初始角色。",
        "- 2 名关键 NPC。",
        "- 1 名可战斗敌人。",
        "- 每个 NPC 需要明确动机、与玩家或主线物品的关系。",
        "- 序章阶段数值不要过高，敌人应能被战斗节点最小模型消费。",
        "",
        "输出字段要求：",
        "- actors：角色数组。",
        "- relationshipNotes：角色关系和潜在分支说明。",
        "- summary：一句话概括角色组的叙事作用。"
      ].join("\n")
    }
  ];
}

export function buildGenerateBranchesMessages(input: GenerateBranchesInput): ChatMessage[] {
  const branchCount = input.branchCount ?? 3;

  return [
    {
      role: "system",
      content: [
        "你是节点式 RPG 剧情工作流设计器。",
        "必须只输出符合 JSON Schema 的 JSON 对象，不要输出 Markdown 或额外解释。",
        "只能使用已有 actor、item、location、attribute key。新增节点 ID 使用 snake_case，且不得与 existingIds 冲突。",
        "条件表达式只能使用允许的 DSL：player.attributes.hp、npc.{id}.relations.player、global.variables.x、global.flags.x、hasItem(\"item_id\")、relation(\"npc_id\")、attr(\"actor_id\", \"key\")，以及 == != > >= < <= && || !。",
        "状态变更必须具体、可回滚，并在 reason 中说明叙事原因。",
        "输出应包含新增 nodes 和 edges，不要改写已有剧情。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `请从当前节点生成 ${branchCount} 条后续剧情分支。`,
        "",
        `输出语言：${input.language ?? DEFAULT_LANGUAGE}`,
        "",
        "当前项目 Markdown 摘要：",
        input.projectMarkdownSummary,
        "",
        "当前节点 JSON：",
        stringifyForPrompt(input.currentNode),
        "",
        "当前运行状态：",
        stringifyForPrompt(input.runtimeState ?? {}),
        "",
        "已有 ID，严禁重复：",
        stringifyForPrompt(input.existingIds),
        "",
        "可用角色：",
        stringifyForPrompt(input.availableActors ?? []),
        "",
        "可用物品：",
        stringifyForPrompt(input.availableItems ?? []),
        "",
        "可用地点：",
        stringifyForPrompt(input.availableLocations ?? []),
        "",
        "可用属性定义：",
        stringifyForPrompt(input.attributeDefs ?? []),
        "",
        `额外要求：${formatList(input.requirements)}`,
        "",
        "分支设计要求：",
        "- 至少包含 1 条战斗或高风险分支。",
        "- 至少包含 1 条交涉或关系分支。",
        "- 至少包含 1 条探索或调查分支。",
        "- 每条分支至少包含 1 个 story 节点。",
        "- 整体输出至少包含 1 个 choice、condition、random 或 mutation 节点。",
        "- 整体输出至少包含 1 个 Effect。",
        "- edges 必须能从 currentNode 的某个输出端口或新增节点流向新增节点。",
        "",
        "输出字段要求：",
        "- nodes：新增节点数组。",
        "- edges：新增连线数组。",
        "- summary：这批分支的叙事摘要。",
        "- integrationNotes：给主编辑器合并时看的注意事项。"
      ].join("\n")
    }
  ];
}

function formatList(value?: string[]): string {
  if (!value || value.length === 0) {
    return "无";
  }

  return value.map(item => item.trim()).filter(Boolean).join("、") || "无";
}

function stringifyForPrompt(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
