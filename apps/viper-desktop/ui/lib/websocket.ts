/**
 * Chat streaming and WebSocket support for Viper IDE.
 * - createChatStream: POST /api/chat with streaming tokens (fetch + ReadableStream).
 * - createChatWebSocket: optional WebSocket client for streaming AI responses.
 */

/** WebSocket client for streaming AI responses (when backend uses WS). */
export function createChatWebSocket(
  url: string,
  onMessage: (chunk: string) => void,
  onClose?: () => void,
  onError?: (err: Event) => void
): WebSocket {
  const ws = new WebSocket(url);
  ws.onmessage = (event) => {
    try {
      const data = typeof event.data === "string" ? event.data : "";
      onMessage(data);
    } catch {
      // ignore
    }
  };
  ws.onclose = () => onClose?.();
  ws.onerror = (e) => onError?.(e);
  return ws;
}

/**
 * Chat API: POST /api/chat with streaming response.
 * Uses fetch + ReadableStream for SSE or chunked transfer.
 */

export interface ChatRequest {
  prompt: string;
  workspacePath?: string;
}

/**
 * Create an async iterable of response chunks (tokens) from POST /api/chat.
 * Expects server to stream text (e.g. SSE or chunked encoding).
 */
export async function* createChatStream(
  url: string,
  body: ChatRequest
): AsyncGenerator<string, void, undefined> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error(`Chat API error: ${res.status} ${res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as { text?: string; token?: string };
            const token = parsed?.text ?? parsed?.token ?? data;
            if (typeof token === "string" && token) yield token;
          } catch {
            if (data) yield data;
          }
        } else if (trimmed && !trimmed.startsWith(":")) {
          yield trimmed;
        }
      }
    }
    if (buffer.trim()) yield buffer.trim();
  } finally {
    reader.releaseLock();
  }
}
