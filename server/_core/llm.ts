import OpenAI from "openai";
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
};

export type JsonSchema = { name: string; schema: Record<string, unknown>; strict?: boolean };
export type OutputSchema = JsonSchema;
export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  toolChoice?: unknown;
  tool_choice?: unknown;
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: Role; content: string; tool_calls?: ToolCall[] };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

function getClient() {
  if (!ENV.openAiKey) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey: ENV.openAiKey });
}

function normalizeContent(content: MessageContent | MessageContent[]): OpenAI.Chat.ChatCompletionContentPart[] | string {
  const parts = Array.isArray(content) ? content : [content];
  if (parts.length === 1 && typeof parts[0] === "string") return parts[0] as string;
  if (parts.length === 1 && (parts[0] as TextContent).type === "text") return (parts[0] as TextContent).text;

  return parts.map((p): OpenAI.Chat.ChatCompletionContentPart => {
    if (typeof p === "string") return { type: "text", text: p };
    if (p.type === "text") return { type: "text", text: p.text };
    if (p.type === "image_url") return { type: "image_url", image_url: { url: p.image_url.url, detail: p.image_url.detail } };
    return { type: "text", text: JSON.stringify(p) };
  });
}

function buildMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((m): OpenAI.Chat.ChatCompletionMessageParam => {
    if (m.role === "tool") {
      const text = Array.isArray(m.content)
        ? m.content.map(p => typeof p === "string" ? p : JSON.stringify(p)).join("\n")
        : typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return { role: "tool", tool_call_id: m.tool_call_id ?? "", content: text };
    }
    const normalized = normalizeContent(m.content);
    return { role: m.role as "system" | "user" | "assistant", content: normalized } as OpenAI.Chat.ChatCompletionMessageParam;
  });
}

function buildResponseFormat(params: InvokeParams): OpenAI.Chat.ChatCompletionCreateParams["response_format"] | undefined {
  const schema = params.outputSchema ?? params.output_schema;
  const fmt = params.responseFormat ?? params.response_format;
  if (fmt) return fmt as OpenAI.Chat.ChatCompletionCreateParams["response_format"];
  if (schema) return { type: "json_schema", json_schema: { name: schema.name, schema: schema.schema, strict: schema.strict ?? true } };
  return undefined;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const client = getClient();
  const maxTokens = params.maxTokens ?? params.max_tokens ?? 4096;

  const payload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: "gpt-4o",
    messages: buildMessages(params.messages),
    max_tokens: maxTokens,
  };

  const responseFormat = buildResponseFormat(params);
  if (responseFormat) payload.response_format = responseFormat;

  const response = await client.chat.completions.create(payload);
  return response as unknown as InvokeResult;
}
