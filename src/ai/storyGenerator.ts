import {
  chatCompletionsJson,
  type AiProviderConfig,
  type ChatCompletionOptions,
  type ChatMessage
} from "./provider";
import {
  buildGenerateActorsMessages,
  buildGenerateBranchesMessages,
  buildGenerateWorldMessages
} from "./prompts";
import {
  aiDraftTypeTitles,
  generateActorsJsonSchema,
  generateBranchesJsonSchema,
  generateWorldJsonSchema,
  validateGenerateActorsOutput,
  validateGenerateBranchesOutput,
  validateGenerateWorldOutput,
  type AiDraft,
  type GenerateActorsInput,
  type GenerateActorsOutput,
  type GenerateBranchesInput,
  type GenerateBranchesOutput,
  type GenerateWorldInput,
  type GenerateWorldOutput,
  type JsonSchema
} from "./schemas";

export interface StoryGenerationOptions
  extends Pick<
    ChatCompletionOptions,
    | "timeoutMs"
    | "signal"
    | "maxTokens"
    | "extraBody"
    | "temperature"
    | "useJsonSchema"
    | "allowJsonSchemaFallback"
    | "strictJsonSchema"
  > {}

export async function generateWorld(
  config: AiProviderConfig,
  input: GenerateWorldInput,
  options: StoryGenerationOptions = {}
): Promise<AiDraft<GenerateWorldOutput>> {
  const payload = await requestStructuredGeneration<GenerateWorldOutput>(
    config,
    buildGenerateWorldMessages(input),
    generateWorldJsonSchema,
    "rpg_generate_world",
    options
  );

  return createAiDraft({
    type: "world",
    promptKind: "world",
    model: config.model,
    payload,
    validationErrors: validateGenerateWorldOutput(payload)
  });
}

export async function generateActors(
  config: AiProviderConfig,
  input: GenerateActorsInput,
  options: StoryGenerationOptions = {}
): Promise<AiDraft<GenerateActorsOutput>> {
  const payload = await requestStructuredGeneration<GenerateActorsOutput>(
    config,
    buildGenerateActorsMessages(input),
    generateActorsJsonSchema,
    "rpg_generate_actors",
    options
  );

  return createAiDraft({
    type: "actor",
    promptKind: "actors",
    model: config.model,
    payload,
    validationErrors: validateGenerateActorsOutput(payload)
  });
}

export async function generateBranches(
  config: AiProviderConfig,
  input: GenerateBranchesInput,
  options: StoryGenerationOptions = {}
): Promise<AiDraft<GenerateBranchesOutput>> {
  const payload = await requestStructuredGeneration<GenerateBranchesOutput>(
    config,
    buildGenerateBranchesMessages(input),
    generateBranchesJsonSchema,
    "rpg_generate_branches",
    options
  );

  return createAiDraft({
    type: "branch",
    promptKind: "branches",
    model: config.model,
    payload,
    validationErrors: validateGenerateBranchesOutput(payload, input.existingIds)
  });
}

async function requestStructuredGeneration<T>(
  config: AiProviderConfig,
  messages: ChatMessage[],
  jsonSchema: JsonSchema,
  schemaName: string,
  options: StoryGenerationOptions
): Promise<T> {
  return chatCompletionsJson<T>(config, messages, {
    jsonSchema,
    jsonSchemaName: schemaName,
    temperature: options.temperature,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    maxTokens: options.maxTokens,
    extraBody: options.extraBody,
    strictJsonSchema: options.strictJsonSchema ?? false,
    useJsonSchema: options.useJsonSchema ?? true,
    allowJsonSchemaFallback: options.allowJsonSchemaFallback ?? true
  });
}

function createAiDraft<TPayload>(input: {
  type: AiDraft<TPayload>["type"];
  promptKind: NonNullable<AiDraft<TPayload>["source"]>["promptKind"];
  model: string;
  payload: TPayload;
  validationErrors: string[];
}): AiDraft<TPayload> {
  return {
    id: createDraftId(input.type),
    type: input.type,
    title: aiDraftTypeTitles[input.type],
    payload: input.payload,
    validationErrors: input.validationErrors,
    createdAt: new Date().toISOString(),
    source: {
      provider: "openai-compatible",
      model: input.model,
      promptKind: input.promptKind
    },
    raw: input.payload
  };
}

function createDraftId(type: AiDraft["type"]): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `draft_${type}_${Date.now()}_${randomPart}`;
}
