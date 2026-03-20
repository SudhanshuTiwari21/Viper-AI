We are implementing **Chat History + Cache Scoping** for the Viper AI system.

Goal:

1. Prevent cross-workspace and cross-conversation cache leakage
2. Enable multi-turn conversations like Cursor
3. Keep backend stateless (no DB for chat)
4. Use frontend-local persistence
5. Ensure LLM responses are context-aware and history-aware

---

# PART 1 — Backend API Changes

Update POST /chat request schema:

Add:

{
  conversationId?: string
  messages?: Array<{
    role: "user" | "assistant"
    content: string
  }>
}

messages should represent LAST N messages (max 10).

If not provided → fallback to single-turn mode.

Also apply the same schema to `POST /chat/stream` so streaming and non-streaming behave consistently.

---

# PART 2 — Assistant Pipeline Update

File:
apps/backend/src/services/assistant.service.ts

Update runAssistantPipeline():

1. Accept:

runAssistantPipeline(prompt, workspacePath, conversationId?, messages?)

2. Pass messages into runDirectLLM()

3. Make intent + reasoning history-aware (CRITICAL for "it/that" pronouns)
   - When `messages` are provided, build a `historyAwarePrompt` that includes:
     - last user/assistant turns (same last N messages)
     - the current user `prompt` as the final line
   - Pass `historyAwarePrompt` into `runIntentPipeline()` so:
     - intent classification
     - entity extraction
     - task planning
     - reasoning prompt
     can resolve references like "it" from earlier turns.

3. When calling LLM:

Construct messages like:

[
  { role: "system", content: SYSTEM_PROMPT },

  ...lastMessages,

  { role: "user", content: prompt }
]

Limit lastMessages to last 6–10 entries.

---

# PART 3 — Cache Scoping (CRITICAL)

We must eliminate prompt-only caching.

Update ALL caches:

- intent classifier
- intent reasoner
- direct LLM
- embeddings (optional improvement)

---

## New Cache Key Design

Create helper:

buildCacheKey({
  workspaceKey,
  conversationId,
  prompt,
  messages,
  intentType,
  contextHash
})

Implementation:

1. Normalize messages → join last N messages
2. Create messagesHash = sha256(messages string)
3. Create contextHash (if available)

Final key:

sha256(
  workspaceKey +
  conversationId +
  prompt +
  messagesHash +
  intentType +
  contextHash
)

---

## Apply to:

1. intent-agent/modules/intent-classifier
2. intent-agent/modules/intent-reasoner
3. assistant.service.ts (directLLMCache)

---

# PART 4 — Context-Aware Cache (IMPORTANT)

When contextWindow is used:

Add:

contextHash = sha256(
  JSON.stringify(contextWindow.files + contextWindow.functions)
)

Include this in cache key.

This prevents stale answers after repo changes.

---

# PART 5 — Safe Defaults

Add env flags:

DISABLE_LLM_CACHE=true (default for safe rollout A)
DISABLE_INTENT_CACHE=true (default for safe rollout A)

If true → bypass cache entirely.

Additionally: if `conversationId` is missing, bypass (or uniquely scope) all caches to avoid cross-conversation leaks.

---

# PART 6 — Logging

Add debug logs:

[Viper] cache hit (scoped)
[Viper] cache miss (scoped)
[Viper] conversationId
[Viper] workspaceKey

---

# PART 7 — Frontend Guidelines (DO NOT IMPLEMENT HERE)

Frontend must:

• generate conversationId (UUID)
• store chats per workspaceKey
• send last N messages with each request

Also:
• derive workspaceKey from `workspacePath` in the same normalized way every time (absolute path, no trailing slashes, consistent separators).

Backend must remain stateless.

---

# PART 8 — Validation Tests

Test cases:

1. Repo A → "Hi"
2. Repo B → "Hi"

EXPECT:
Different responses (no cache reuse)

---

3. Same conversation:

User: "Fix login API"
User: "Now optimize it"

EXPECT:
Second response uses context from previous message

---

4. Same prompt, different context:

Modify repo → same prompt

EXPECT:
Cache MISS (because contextHash changed)

---

# CONSTRAINTS

• Do NOT change existing pipeline outputs
• Do NOT persist chat in backend DB
• Do NOT send full history (limit to last N)
• Maintain performance (<500ms target)

---

# GOAL

Transform Viper AI from single-turn system → multi-turn, context-aware, production-grade AI IDE backend like Cursor.