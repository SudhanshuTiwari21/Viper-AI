import { hashString } from "./hash.js";

export type CacheKeyMessage = {
  role: string;
  content: string;
};

export type CacheKeyContext = {
  workspaceKey?: string;
  conversationId?: string;
  prompt: string;
  messages?: CacheKeyMessage[];
  intentType?: string;
  contextHash?: string;
};

function normalizeMessages(messages: CacheKeyMessage[] | undefined): string {
  if (!messages || messages.length === 0) return "no-messages";
  return messages
    .map((m) => `${m.role}:${m.content}`)
    .join("\n");
}

/**
 * Deterministic cache key for scoping LLM/candidate caches.
 *
 * IMPORTANT: This key intentionally includes `workspaceKey` and `conversationId`
 * to prevent cross-workspace/cross-conversation cache reuse.
 */
export function buildCacheKey(ctx: CacheKeyContext): string {
  const workspaceKey = ctx.workspaceKey ?? "no-workspace";
  const conversationId = ctx.conversationId ?? "no-conversation";
  const prompt = ctx.prompt ?? "";
  const messagesStr = normalizeMessages(ctx.messages);
  const messagesHash = hashString(messagesStr);
  const intentType = ctx.intentType ?? "";
  const contextHash = ctx.contextHash ?? "";

  return hashString(
    [
      workspaceKey,
      conversationId,
      prompt,
      messagesHash,
      intentType,
      contextHash,
    ].join("|"),
  );
}

