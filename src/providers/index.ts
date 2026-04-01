import { getProviderStorageKey, type ProviderConfig } from './config.js';

export interface CompletionRequest {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  modelOverride?: string;
  stagedContent?: string;
}

export interface CompletionUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface CompletionResult {
  text: string;
  usage?: CompletionUsage;
}

export interface Provider {
  id: string;
  name: string;
  generateCompletion(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult>;
}

export type OpenAiCompatibleSystemMode = 'system' | 'inline_user';

interface OpenAiCompatibleMessage {
  role: 'system' | 'user';
  content: string;
}

interface OpenAiCompatiblePayload {
  model: string;
  messages: OpenAiCompatibleMessage[];
  temperature?: number;
}

interface AnthropicPayload {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: 'user'; content: string }[];
  temperature?: number;
}

function combineUserContent(request: CompletionRequest, includeSystemPrompt: boolean): string {
  const sections: string[] = [];

  if (includeSystemPrompt && request.systemPrompt.trim()) {
    sections.push(`Follow these instructions exactly:\n\n${request.systemPrompt}`);
  }

  sections.push(request.userMessage);

  if (request.stagedContent) {
    sections.push(`Additional context:\n\n${request.stagedContent}`);
  }

  return sections.join('\n\n');
}

export function buildOpenAiCompatiblePayload(
  request: CompletionRequest,
  model: string,
  systemMode: OpenAiCompatibleSystemMode = 'system'
): OpenAiCompatiblePayload {
  const payload: OpenAiCompatiblePayload = {
    model,
    messages: systemMode === 'system'
      ? [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: combineUserContent(request, false) }
        ]
      : [{ role: 'user', content: combineUserContent(request, true) }]
  };

  if (request.temperature !== undefined) {
    payload.temperature = request.temperature;
  }

  return payload;
}

export function extractOpenAiCompatibleText(data: unknown): string {
  const content = (data as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  })?.choices?.[0]?.message?.content;

  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(part => part?.type === 'text' && typeof part.text === 'string')
      .map(part => part.text as string)
      .join('');
  }

  return '';
}

export function extractOpenAiCompatibleUsage(data: unknown): CompletionUsage | undefined {
  const usage = (data as {
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  })?.usage;

  if (!usage) return undefined;

  return {
    inputTokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : undefined,
    outputTokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : undefined,
    totalTokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : undefined,
  };
}

export function buildAnthropicPayload(request: CompletionRequest, model: string): AnthropicPayload {
  const payload: AnthropicPayload = {
    model,
    max_tokens: 4096,
    system: request.systemPrompt,
    messages: [{ role: 'user', content: combineUserContent(request, false) }]
  };

  if (request.temperature !== undefined) {
    payload.temperature = request.temperature;
  }

  return payload;
}

export function extractAnthropicText(data: unknown): string {
  const content = (data as {
    content?: Array<{ type?: string; text?: string }>;
  })?.content;

  return content
    ?.filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text as string)
    .join('') || '';
}

export function extractAnthropicUsage(data: unknown): CompletionUsage | undefined {
  const usage = (data as {
    usage?: { input_tokens?: number; output_tokens?: number };
  })?.usage;

  if (!usage) return undefined;

  const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : undefined;
  const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : undefined;

  return {
    inputTokens,
    outputTokens,
    totalTokens:
      inputTokens !== undefined || outputTokens !== undefined
        ? (inputTokens || 0) + (outputTokens || 0)
        : undefined,
  };
}

class OpenAICompatibleProvider implements Provider {
  constructor(
    public id: string,
    public name: string,
    private apiKey: string,
    private defaultModel: string,
    private baseUrl: string,
    private systemMode: OpenAiCompatibleSystemMode = 'system'
  ) {}

  async generateCompletion(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
    const payload = buildOpenAiCompatiblePayload(
      request,
      request.modelOverride || this.defaultModel,
      this.systemMode
    );

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Provider request failed (${response.status}): ${details}`);
    }

    const data = await response.json();
    return {
      text: extractOpenAiCompatibleText(data),
      usage: extractOpenAiCompatibleUsage(data)
    };
  }
}

class AnthropicProvider implements Provider {
  constructor(
    public id: string,
    public name: string,
    private apiKey: string,
    private defaultModel: string,
    private baseUrl: string
  ) {}

  async generateCompletion(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
    const payload = buildAnthropicPayload(request, request.modelOverride || this.defaultModel);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${details}`);
    }

    const data = await response.json();
    return {
      text: extractAnthropicText(data),
      usage: extractAnthropicUsage(data)
    };
  }
}

export function createProvider(
  providerConfig: ProviderConfig,
  keys: Record<string, string | undefined>
): Provider | null {
  const storageKey = getProviderStorageKey(providerConfig.id);
  const apiKey = keys[storageKey];
  if (!apiKey) {
    return null;
  }

  if (providerConfig.type === 'openai-compatible') {
    return new OpenAICompatibleProvider(
      providerConfig.id,
      providerConfig.label,
      apiKey,
      providerConfig.defaultModel,
      providerConfig.baseUrl,
      providerConfig.systemMode || 'system'
    );
  }

  if (providerConfig.type === 'anthropic') {
    return new AnthropicProvider(
      providerConfig.id,
      providerConfig.label,
      apiKey,
      providerConfig.defaultModel,
      providerConfig.baseUrl
    );
  }

  return null;
}
