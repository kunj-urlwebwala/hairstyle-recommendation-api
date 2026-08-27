import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type MessageContent = string | TextContent | ImageContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
};

export type InvokeParams = {
  messages: Message[];
  maxTokens?: number;
  responseFormat?: { type: "text" } | { type: "json_object" };
  model?: string;
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

const ensureArray = (
  value: MessageContent | MessageContent[],
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeMessage = (message: Message) => {
  const parts = ensureArray(message.content);

  if (parts.length === 1 && typeof parts[0] === "string") {
    return { role: message.role, content: parts[0] };
  }

  return { role: message.role, content: parts };
};

type Provider = {
  url: string;
  apiKey: string;
};

// Both providers expose an OpenAI-compatible chat completions API, so a single
// request shape works for either. The model name decides where a call goes.
function resolveProvider(model: string): Provider {
  if (model.startsWith("gemini")) {
    if (!ENV.geminiApiKey) throw new Error("GEMINI_API_KEY is not configured");
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: ENV.geminiApiKey,
    };
  }

  if (!ENV.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured");
  return {
    url: "https://api.openai.com/v1/chat/completions",
    apiKey: ENV.openAiApiKey,
  };
}

const RETRY_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 15_000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Equal-jitter exponential backoff so a failing upstream is not hammered.
const computeBackoffDelay = (
  attempt: number,
  retryAfterMs?: number,
): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

// Retries non-2xx responses and network errors with exponential backoff, then returns
// the final Response so callers keep their existing error handling.
const fetchWithBackoff = async (
  url: string,
  init: NonNullable<Parameters<typeof fetch>[1]>,
): Promise<Response> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES) {
        return response;
      }

      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const retryAfterMs = Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds * 1000
        : undefined;

      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`,
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`,
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM request failed after retries");
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const model = params.model ?? ENV.analysisPrimaryModel;
  const provider = resolveProvider(model);

  const payload: Record<string, unknown> = {
    model,
    messages: params.messages.map(normalizeMessage),
  };

  if (typeof params.maxTokens === "number") {
    payload.max_tokens = params.maxTokens;
  }

  if (params.responseFormat) {
    payload.response_format = params.responseFormat;
  }

  const response = await fetchWithBackoff(provider.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`,
    );
  }

  return (await response.json()) as InvokeResult;
}
