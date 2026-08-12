import type {
  Actor,
  AttributeValue,
  Choice,
  CombatNode,
  Condition,
  Effect,
  GameProject,
  InventoryEntry,
  Item,
  WorkflowEdge,
  WorkflowNode
} from "../domain/types";

export interface ExportMarkdownOptions {
  includeAiNotes?: boolean;
  includeJsonBlocks?: boolean;
}

interface OrderedNode {
  node: WorkflowNode;
  repeated: boolean;
}

export function exportMarkdown(project: GameProject, options: ExportMarkdownOptions = {}): string {
  const includeAiNotes = options.includeAiNotes ?? true;
  const includeJsonBlocks = options.includeJsonBlocks ?? false;
  const lines: string[] = [];
  const edgesByNode = groupEdgesBySource(project.workflow.edges);
  const orderedNodes = getWorkflowTraversal(project);
  const conditions = collectConditions(project);
  const effects = collectEffects(project);

  lines.push(`# ${plain(project.meta.title)}`);
  lines.push("");
  lines.push("## Project Info / \u9879\u76ee\u4fe1\u606f");
  pushKeyValue(lines, "Author / \u4f5c\u8005", project.meta.author);
  pushKeyValue(lines, "Created At / \u521b\u5efa\u65f6\u95f4", project.meta.createdAt);
  pushKeyValue(lines, "Updated At / \u66f4\u65b0\u65f6\u95f4", project.meta.updatedAt);
  pushKeyValue(lines, "Description / \u7b80\u4ecb", project.meta.description);
  lines.push("");

  lines.push("## World Background / \u4e16\u754c\u80cc\u666f");
  lines.push(plain(project.world.premise) || "N/A");
  lines.push("");

  lines.push("## Narrative Tone / \u53d9\u4e8b\u98ce\u683c");
  lines.push(plain(project.world.tone) || "N/A");
  pushKeyValue(lines, "Genre / \u7c7b\u578b", project.world.genre);
  lines.push("");

  lines.push("## Themes / \u4e3b\u9898");
  pushList(lines, project.world.themes ?? [], theme => plain(theme), "N/A");
  lines.push("");

  lines.push("## Locations / \u5730\u70b9");
  if (project.world.locations.length === 0) {
    lines.push("N/A");
  } else {
    project.world.locations.forEach(location => {
      lines.push(`### ${plain(location.id)} ${plain(location.name)}`.trimEnd());
      lines.push(plain(location.summary) || "N/A");
      pushInlineList(lines, "Tags / \u6807\u7b7e", location.tags);
      pushKeyValue(lines, "Parent Location / \u4e0a\u7ea7\u5730\u70b9", location.parentLocationId);
      lines.push("");
    });
  }

  lines.push("## Factions / \u9635\u8425");
  if (project.world.factions.length === 0) {
    lines.push("N/A");
  } else {
    project.world.factions.forEach(faction => {
      lines.push(`### ${plain(faction.id)} ${plain(faction.name)}`.trimEnd());
      lines.push(plain(faction.summary) || "N/A");
      pushKeyValue(lines, "Alignment / \u7acb\u573a", faction.alignment);
      if (faction.relations && Object.keys(faction.relations).length > 0) {
        pushKeyValue(lines, "Relations / \u5173\u7cfb", formatRecord(faction.relations));
      }
      lines.push("");
    });
  }

  if (project.world.loreEntries && project.world.loreEntries.length > 0) {
    lines.push("## Lore Entries / \u8bbe\u5b9a\u6761\u76ee");
    project.world.loreEntries.forEach(entry => {
      lines.push(`### ${plain(entry.id)} ${plain(entry.title)}`.trimEnd());
      lines.push(plain(entry.content));
      lines.push("");
    });
  }

  lines.push("## Actors / \u89d2\u8272");
  if (project.actors.length === 0) {
    lines.push("N/A");
  } else {
    project.actors.forEach(actor => renderActor(lines, actor, project.items, includeAiNotes));
  }

  lines.push("## Items / \u7269\u54c1");
  if (project.items.length === 0) {
    lines.push("N/A");
  } else {
    project.items.forEach(item => renderItem(lines, item));
  }

  lines.push("## Initial Global State / \u521d\u59cb\u5168\u5c40\u72b6\u6001");
  pushKeyValue(lines, "Player Actor / \u73a9\u5bb6\u89d2\u8272", project.state.playerId);
  pushKeyValue(lines, "Variables / \u53d8\u91cf", formatRecord(project.state.global.variables));
  pushKeyValue(lines, "Flags", formatRecord(project.state.global.flags));
  pushKeyValue(lines, "Discovered Locations / \u5df2\u53d1\u73b0\u5730\u70b9", project.state.global.discoveredLocations.join(", ") || "None");
  pushKeyValue(lines, "Completed Quests / \u5df2\u5b8c\u6210\u4efb\u52a1", project.state.global.completedQuests?.join(", ") || "None");
  lines.push("");

  lines.push("## Story Flow / \u5267\u60c5\u6d41\u7a0b");
  orderedNodes.forEach(({ node, repeated }) => {
    renderNode(lines, node, edgesByNode.get(node.id) ?? [], {
      includeAiNotes,
      includeJsonBlocks,
      repeated
    });
  });

  lines.push("## Condition Index / \u6761\u4ef6\u7d22\u5f15");
  if (conditions.length === 0) {
    lines.push("N/A");
  } else {
    conditions.forEach(entry => {
      const label = entry.condition.label ? ` ${plain(entry.condition.label)}` : "";
      lines.push(`- ${plain(entry.condition.id)}${label}: \`${entry.condition.expression}\` (source: ${entry.source})`);
    });
  }
  lines.push("");

  lines.push("## State Change Index / \u72b6\u6001\u53d8\u66f4\u7d22\u5f15");
  if (effects.length === 0) {
    lines.push("N/A");
  } else {
    effects.forEach(entry => {
      lines.push(`- ${plain(entry.effect.id)}: ${formatEffect(entry.effect)} (source: ${entry.source})`);
      if (entry.effect.reason) {
        lines.push(`  Reason / \u539f\u56e0: ${plain(entry.effect.reason)}`);
      }
    });
  }
  lines.push("");

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function renderActor(lines: string[], actor: Actor, items: Item[], includeAiNotes: boolean): void {
  lines.push(`### ${plain(actor.id)} ${plain(actor.name)}`.trimEnd());
  pushKeyValue(lines, "Role / \u7c7b\u578b", actor.role);
  pushKeyValue(lines, "Summary / \u7b80\u4ecb", actor.summary);
  pushKeyValue(lines, "Biography / \u4f20\u8bb0", actor.biography);
  pushKeyValue(lines, "Faction / \u9635\u8425", actor.factionId);
  pushKeyValue(lines, "Location / \u5f53\u524d\u5730\u70b9", actor.locationId);
  pushKeyValue(lines, "Attributes / \u5c5e\u6027", formatRecord(actor.attributes));
  pushKeyValue(lines, "Inventory / \u7269\u54c1", formatInventory(actor.inventory, items));
  pushKeyValue(lines, "Flags", formatRecord(actor.flags));
  pushKeyValue(lines, "Relations / \u5173\u7cfb", actor.relations ? formatRecord(actor.relations) : undefined);
  pushInlineList(lines, "Tags / \u6807\u7b7e", actor.tags);
  if (includeAiNotes) {
    pushKeyValue(lines, "AI Notes / AI \u5907\u6ce8", actor.aiNotes);
  }
  lines.push("");
}

function renderItem(lines: string[], item: Item): void {
  lines.push(`### ${plain(item.id)} ${plain(item.name)}`.trimEnd());
  pushKeyValue(lines, "Type / \u7c7b\u578b", item.type);
  pushKeyValue(lines, "Description / \u63cf\u8ff0", item.description);
  pushKeyValue(lines, "Stackable / \u53ef\u5806\u53e0", item.stackable === undefined ? undefined : item.stackable ? "Yes" : "No");
  pushKeyValue(lines, "Max Stack / \u6700\u5927\u5806\u53e0", item.maxStack === undefined ? undefined : String(item.maxStack));
  pushKeyValue(lines, "Attributes / \u5c5e\u6027", item.attributes ? formatRecord(item.attributes) : undefined);
  pushInlineList(lines, "Tags / \u6807\u7b7e", item.tags);
  lines.push("");
}

function renderNode(
  lines: string[],
  node: WorkflowNode,
  outgoingEdges: WorkflowEdge[],
  options: Required<ExportMarkdownOptions> & { repeated: boolean }
): void {
  lines.push(`### ${plain(node.id)} ${plain(node.title)}`.trimEnd());
  lines.push(`- Type / \u7c7b\u578b: ${node.type}`);

  if (options.repeated) {
    lines.push("- Repeated reference / \u91cd\u590d\u5f15\u7528: already expanded above.");
    lines.push("");
    return;
  }

  if ("locationId" in node) {
    pushKeyValue(lines, "Location / \u5730\u70b9", node.locationId);
  }
  if ("speakerId" in node) {
    pushKeyValue(lines, "Speaker / \u8bf4\u8bdd\u8005", node.speakerId);
  }
  if ("sceneTags" in node) {
    pushInlineList(lines, "Scene Tags / \u573a\u666f\u6807\u7b7e", node.sceneTags);
  }

  if (node.type === "story") {
    lines.push("");
    lines.push(plain(node.content) || "N/A");
  }

  if (node.type === "choice") {
    lines.push("");
    lines.push(plain(node.prompt) || "N/A");
    lines.push("");
    lines.push("Choices / \u9009\u9879:");
    node.choices.forEach(choice => renderChoice(lines, choice));
  }

  if (node.type === "condition") {
    lines.push("");
    lines.push("Condition Branches / \u6761\u4ef6\u5206\u652f:");
    node.branches.forEach(branch => {
      lines.push(`- ${branch.port}: ${plain(branch.label)}, condition \`${branch.condition.expression}\``);
    });
    lines.push(`- fallback: ${node.fallbackPort}`);
  }

  if (node.type === "random") {
    lines.push("");
    lines.push("Random Branches / \u968f\u673a\u5206\u652f:");
    node.branches.forEach(branch => {
      lines.push(`- ${branch.port}: ${plain(branch.label)}, weight ${branch.weight}`);
    });
    pushKeyValue(lines, "Seed / \u968f\u673a\u79cd\u5b50", node.seedKey);
  }

  if (node.type === "mutation") {
    lines.push("");
    lines.push("State Changes / \u72b6\u6001\u53d8\u66f4:");
    node.effects.forEach(effect => {
      lines.push(`- ${formatEffect(effect)}`);
      if (effect.reason) {
        lines.push(`  Reason / \u539f\u56e0: ${plain(effect.reason)}`);
      }
    });
  }

  if (node.type === "combat") {
    renderCombatNode(lines, node);
  }

  if (node.type === "end") {
    pushKeyValue(lines, "Ending ID / \u7ed3\u5c40 ID", node.endingId);
    pushKeyValue(lines, "Ending Title / \u7ed3\u5c40\u6807\u9898", node.endingTitle);
    pushKeyValue(lines, "Ending Summary / \u7ed3\u5c40\u6458\u8981", node.endingSummary);
  }

  renderOutgoingEdges(lines, outgoingEdges);

  if (options.includeJsonBlocks) {
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(node, null, 2));
    lines.push("```");
  }

  lines.push("");
}

function renderChoice(lines: string[], choice: Choice): void {
  lines.push(`- ${plain(choice.id)}: ${plain(choice.text)}`);
  pushNestedConditions(lines, "Visible When / \u53ef\u89c1\u6761\u4ef6", choice.visibleWhen);
  pushNestedConditions(lines, "Enabled When / \u53ef\u7528\u6761\u4ef6", choice.enabledWhen);
  choice.effects?.forEach(effect => {
    lines.push(`  State Change / \u72b6\u6001\u53d8\u66f4: ${formatEffect(effect)}`);
  });
  if (choice.nextNodeId) {
    lines.push(`  Direct Next Node / \u76f4\u63a5\u4e0b\u4e00\u8282\u70b9: ${plain(choice.nextNodeId)}`);
  }
}

function renderCombatNode(lines: string[], node: CombatNode): void {
  lines.push("");
  lines.push("Enemies / \u654c\u4eba:");
  node.enemies.forEach(enemy => {
    lines.push(`- ${enemy.actorId}${enemy.level === undefined ? "" : `, level ${enemy.level}`}`);
  });
  pushKeyValue(lines, "Escape Allowed / \u5141\u8bb8\u9003\u8dd1", node.escapeAllowed ? "Yes" : "No");
  renderEffectGroup(lines, "Win Effects / \u80dc\u5229\u6548\u679c", node.winEffects);
  renderEffectGroup(lines, "Lose Effects / \u5931\u8d25\u6548\u679c", node.loseEffects);
  renderEffectGroup(lines, "Escape Effects / \u9003\u8dd1\u6548\u679c", node.escapeEffects);
}

function renderEffectGroup(lines: string[], title: string, effects?: Effect[]): void {
  if (!effects || effects.length === 0) {
    return;
  }
  lines.push(`${title}:`);
  effects.forEach(effect => {
    lines.push(`- ${formatEffect(effect)}`);
  });
}

function renderOutgoingEdges(lines: string[], outgoingEdges: WorkflowEdge[]): void {
  lines.push("");
  lines.push("Flow / \u6d41\u5411:");
  if (outgoingEdges.length === 0) {
    lines.push("- None");
    return;
  }
  outgoingEdges.forEach(edge => {
    const guard = edge.guard ? `, guard \`${edge.guard.expression}\`` : "";
    const label = edge.label ? `, ${plain(edge.label)}` : "";
    lines.push(`- ${edge.id}: ${edge.from.port} -> ${edge.to.nodeId}${label}${guard}`);
  });
}

function getWorkflowTraversal(project: GameProject): OrderedNode[] {
  const graph = project.workflow;
  const visited = new Set<string>();
  const result: OrderedNode[] = [];
  const queue = [graph.startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) {
      continue;
    }

    const node = graph.nodes[nodeId];
    if (!node) {
      continue;
    }

    visited.add(nodeId);
    result.push({ node, repeated: false });

    graph.edges
      .filter(edge => edge.from.nodeId === nodeId)
      .forEach(edge => {
        if (!visited.has(edge.to.nodeId)) {
          queue.push(edge.to.nodeId);
        } else {
          const repeatedNode = graph.nodes[edge.to.nodeId];
          if (repeatedNode) {
            result.push({ node: repeatedNode, repeated: true });
          }
        }
      });
  }

  Object.values(graph.nodes)
    .filter(node => !visited.has(node.id))
    .forEach(node => result.push({ node, repeated: false }));

  return result;
}

function collectConditions(project: GameProject): Array<{ source: string; condition: Condition }> {
  const entries: Array<{ source: string; condition: Condition }> = [];

  Object.values(project.workflow.nodes).forEach(node => {
    if (node.type === "choice") {
      node.choices.forEach(choice => {
        choice.visibleWhen?.forEach(condition => entries.push({ source: `${node.id}.${choice.id}.visibleWhen`, condition }));
        choice.enabledWhen?.forEach(condition => entries.push({ source: `${node.id}.${choice.id}.enabledWhen`, condition }));
      });
    }
    if (node.type === "condition") {
      node.branches.forEach(branch => {
        entries.push({ source: `${node.id}.${branch.port}`, condition: branch.condition });
      });
    }
  });

  project.workflow.edges.forEach(edge => {
    if (edge.guard) {
      entries.push({ source: `${edge.id}.guard`, condition: edge.guard });
    }
  });

  return entries;
}

function collectEffects(project: GameProject): Array<{ source: string; effect: Effect }> {
  const entries: Array<{ source: string; effect: Effect }> = [];

  Object.values(project.workflow.nodes).forEach(node => {
    if (node.type === "choice") {
      node.choices.forEach(choice => {
        choice.effects?.forEach(effect => entries.push({ source: `${node.id}.${choice.id}`, effect }));
      });
    }
    if (node.type === "mutation") {
      node.effects.forEach(effect => entries.push({ source: node.id, effect }));
    }
    if (node.type === "combat") {
      node.winEffects?.forEach(effect => entries.push({ source: `${node.id}.win`, effect }));
      node.loseEffects?.forEach(effect => entries.push({ source: `${node.id}.lose`, effect }));
      node.escapeEffects?.forEach(effect => entries.push({ source: `${node.id}.escape`, effect }));
    }
  });

  return entries;
}

function groupEdgesBySource(edges: WorkflowEdge[]): Map<string, WorkflowEdge[]> {
  const map = new Map<string, WorkflowEdge[]>();
  edges.forEach(edge => {
    const existing = map.get(edge.from.nodeId) ?? [];
    existing.push(edge);
    map.set(edge.from.nodeId, existing);
  });
  return map;
}

function pushNestedConditions(lines: string[], label: string, conditions?: Condition[]): void {
  conditions?.forEach(condition => {
    const conditionLabel = condition.label ? `${plain(condition.label)}, ` : "";
    lines.push(`  ${label}: ${conditionLabel}\`${condition.expression}\``);
  });
}

function pushKeyValue(lines: string[], key: string, value?: AttributeValue | string): void {
  if (value === undefined || value === "") {
    return;
  }
  lines.push(`- ${key}: ${plain(String(value))}`);
}

function pushInlineList(lines: string[], key: string, values?: string[]): void {
  if (!values || values.length === 0) {
    return;
  }
  lines.push(`- ${key}: ${values.map(value => plain(value)).join(", ")}`);
}

function pushList<T>(lines: string[], values: T[], mapValue: (value: T) => string, emptyText: string): void {
  if (values.length === 0) {
    lines.push(emptyText);
    return;
  }
  values.forEach(value => lines.push(`- ${mapValue(value)}`));
}

function formatInventory(inventory: InventoryEntry[], items: Item[]): string {
  if (!inventory || inventory.length === 0) {
    return "None";
  }

  const itemById = new Map(items.map(item => [item.id, item]));
  return inventory
    .map(entry => {
      const item = itemById.get(entry.itemId);
      const name = item ? item.name : entry.itemId;
      const equipped = entry.equipped ? ", equipped" : "";
      return `${name}(${entry.itemId}) x${entry.count}${equipped}`;
    })
    .join(", ");
}

function formatRecord(record: Record<string, AttributeValue | number>): string {
  const entries = Object.entries(record);
  if (entries.length === 0) {
    return "None";
  }
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ");
}

function formatEffect(effect: Effect): string {
  const value = effect.value === undefined ? "" : ` ${formatEffectValue(effect.value)}`;
  return `${formatEffectTarget(effect)} ${effect.op}${value}`.trim();
}

function formatEffectTarget(effect: Effect): string {
  const actor = effect.target.actorId ? `.${effect.target.actorId}` : "";
  return `${effect.target.scope}${actor}.${effect.target.path}`;
}

function formatEffectValue(value: Effect["value"]): string {
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

function plain(value?: string): string {
  return value?.replace(/\r\n/g, "\n").trim() ?? "";
}
