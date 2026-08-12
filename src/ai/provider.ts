export interface AiProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
}

export type JsonSchema = Record<string, unknown>;

export interface ChatCompletionOptions {
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  jsonSchema?: JsonSchema;
  jsonSchemaName?: string;
  strictJsonSchema?: boolean;
  useJsonSchema?: boolean;
  allowJsonSchemaFallback?: boolean;
  maxTokens?: number;
  extraBody?: Record<string, unknown>;
}

export interface ChatCompletionResult {
  content: string;
  raw: unknown;
  model?: string;
  usage?: unknown;
  finishReason?: string;
  usedJsonSchema: boolean;
}

export class AiProviderError extends Error {
  status?: number;
  body?: string;
  retryable: boolean;

  constructor(message: string, options: { status?: number; body?: string; retryable?: boolean } = {}) {
    super(message);
    this.name = "AiProviderError";
    this.status = options.status;
    this.body = options.body;
    this.retryable = options.retryable ?? false;
  }
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export async function chatCompletions(
  config: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  assertProviderConfig(config);

  const shouldUseJsonSchema = Boolean(options.jsonSchema && options.useJsonSchema !== false);

  try {
    return await postChatCompletion(config, messages, options, shouldUseJsonSchema);
  } catch (error) {
    const canFallback =
      shouldUseJsonSchema &&
      options.allowJsonSchemaFallback !== false &&
      error instanceof AiProviderError &&
      (error.status === 400 || error.status === 404 || error.status === 422);

    if (!canFallback) {
      throw error;
    }

    return postChatCompletion(config, messages, options, false);
  }
}

export async function chatCompletionsJson<T>(
  config: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<T> {
  const result = await chatCompletions(config, messages, options);
  return parseJsonFromText<T>(result.content);
}

export function parseJsonFromText<T = unknown>(text: string): T {
  const trimmed = text.replace(/^\uFEFF/, "").trim();

  if (!trimmed) {
    throw new AiProviderError("AI response content is empty.");
  }

  const candidates = [
    trimmed,
    ...extractJsonCodeFenceCandidates(trimmed),
    extractBalancedJsonCandidate(trimmed)
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try the next fallback candidate.
    }
  }

  throw new AiProviderError("AI response is not valid JSON.", {
    body: trimmed.slice(0, 2000)
  });
}

function assertProviderConfig(config: AiProviderConfig): void {
  if (!config.model || config.model.trim() === "") {
    throw new AiProviderError("AI model is required.");
  }
}

async function postChatCompletion(
  config: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions,
  useJsonSchema: boolean
): Promise<ChatCompletionResult> {
  const controller = createTimeoutController(options.signal, options.timeoutMs ?? config.timeoutMs);
  const body = buildRequestBody(config, messages, options, useJsonSchema);

  let response: Response;
  try {
    response = await fetch(resolveChatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    controller.dispose();
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiProviderError("AI request timed out or was aborted.", {
        retryable: true
      });
    }
    throw error;
  }

  controller.dispose();

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new AiProviderError(`AI request failed with HTTP ${response.status}.`, {
      status: response.status,
      body: errorBody,
      retryable: response.status === 429 || response.status >= 500
    });
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const firstChoice = Array.isArray(raw.choices) ? raw.choices[0] : undefined;
  const choiceRecord =
    firstChoice && typeof firstChoice === "object"
      ? (firstChoice as Record<string, unknown>)
      : undefined;
  const messageRecord =
    choiceRecord?.message && typeof choiceRecord.message === "object"
      ? (choiceRecord.message as Record<string, unknown>)
      : undefined;
  const content = extractMessageContent(messageRecord?.content);

  if (!content) {
    throw new AiProviderError("AI response content is empty.", {
      body: JSON.stringify(raw).slice(0, 2000)
    });
  }

  return {
    content,
    raw,
    model: typeof raw.model === "string" ? raw.model : undefined,
    usage: raw.usage,
    finishReason:
      typeof choiceRecord?.finish_reason === "string" ? choiceRecord.finish_reason : undefined,
    usedJsonSchema: useJsonSchema
  };
}

function buildRequestBody(
  config: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions,
  useJsonSchema: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options.temperature ?? config.temperature ?? 0.8,
    ...options.extraBody
  };

  if (typeof options.maxTokens === "number") {
    body.max_tokens = options.maxTokens;
  }

  if (useJsonSchema && options.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: options.jsonSchemaName ?? "rpg_story_generation",
        strict: options.strictJsonSchema ?? false,
        schema: options.jsonSchema
      }
    };
  }

  return body;
}

function buildHeaders(config: AiProviderConfig): Record<string, string> {
  return {
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    "Content-Type": "application/json",
    ...(config.headers ?? {})
  };
}

function resolveChatCompletionsUrl(baseUrl = DEFAULT_BASE_URL): string {
  const cleaned = baseUrl.replace(/\/+$/, "");
  return cleaned.endsWith("/chat/completions") ? cleaned : `${cleaned}/chat/completions`;
}

function extractMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map(part => {
      if (typeof part === "string") {
        return part;
      }
      if (part && typeof part === "object") {
        const record = part as Record<string, unknown>;
        if (typeof record.text === "string") {
          return record.text;
        }
      }
      return "";
    })
    .join("")
    .trim();
}

function createTimeoutController(signal?: AbortSignal, timeoutMs?: number) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const abortFromParent = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  return {
    signal: controller.signal,
    dispose() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      signal?.removeEventListener("abort", abortFromParent);
    }
  };
}

function extractJsonCodeFenceCandidates(text: string): string[] {
  const candidates: string[] = [];
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(text))) {
    candidates.push(match[1].trim());
  }

  return candidates;
}

function extractBalancedJsonCandidate(text: string): string | null {
  const start = findFirstJsonStart(text);
  if (start === -1) {
    return null;
  }

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      if (stack.pop() !== expected) {
        return null;
      }
      if (stack.length === 0) {
        return text.slice(start, index + 1).trim();
      }
    }
  }

  return null;
}

function findFirstJsonStart(text: string): number {
  const objectIndex = text.indexOf("{");
  const arrayIndex = text.indexOf("[");

  if (objectIndex === -1) {
    return arrayIndex;
  }
  if (arrayIndex === -1) {
    return objectIndex;
  }

  return Math.min(objectIndex, arrayIndex);
}
