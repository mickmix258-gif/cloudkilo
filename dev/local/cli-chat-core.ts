export interface KiloConfig {
  model?: string;
  models?: {
    default?: string;
    free_tier?: string;
    routing?: Record<string, string>;
    free_models?: string[];
  };
  gateway?: {
    url?: string;
    auto_select?: boolean;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SendChatOptions {
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const DEFAULT_GATEWAY_URL = 'https://ai-gateway.kilo.ai/api/v1';
export const DEFAULT_MODEL = 'kilo-auto/free';
export const DEFAULT_TIMEOUT_MS = 30_000;

export function getDefaultModel(config: KiloConfig): string {
  return config.model?.trim() || config.models?.default?.trim() || DEFAULT_MODEL;
}

export function getGatewayUrl(config: KiloConfig): string {
  return (config.gateway?.url?.trim() || DEFAULT_GATEWAY_URL).replace(/\/+$/, '');
}

export function buildAuthHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = apiKey?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function sendChat(
  gatewayUrl: string,
  model: string,
  messages: ChatMessage[],
  options: SendChatOptions = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey?.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const baseUrl = gatewayUrl.trim().replace(/\/+$/, '');

  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildAuthHeaders(apiKey),
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    if (!response.ok) {
      if (response.status === 401 && !apiKey) {
        throw new Error(
          'This model requires authentication. Set KILO_API_KEY in your environment, or select a free model for anonymous access.'
        );
      }
      throw new Error(
        `Kilo Gateway error (${response.status}): ${responseText.slice(0, 500) || response.statusText}`
      );
    }

    let payload: {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    try {
      payload = JSON.parse(responseText) as typeof payload;
    } catch {
      throw new Error('Kilo Gateway returned an invalid JSON response.');
    }

    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Kilo Gateway returned no text content for this response.');
    }
    return content;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Kilo Gateway request timed out after ${timeoutMs} ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
