# Intent Agent + Context Engine (Detailed, Current Wiring)

## Goal

Explain how the **Intent Agent** works together with the **Context Engine** in the current system:
1. What each Intent Agent module does (inputs/outputs + logic).
2. How intent categories are classified.
3. The exact prompts used for the LLM calls.
4. How the intent result becomes a **context request** that drives the context engine.
5. How the backend feeds the **context engine output (`contextWindow`)** into the intent reasoner so reasoning aligns with retrieved context.

---

## 1. Current end-to-end flow (where context engine fits)

### 1.1 Backend request entry

When you send a chat request, the backend route validates and forwards it:
- `apps/backend/src/routes/chat.routes.ts` validates schema
- `apps/backend/src/controllers/chat.controller.ts` extracts:
  - `prompt`
  - `workspacePath`
  - `conversationId?`
  - `messages?`
- `apps/backend/src/services/assistant.service.ts` runs `runAssistantPipeline(prompt, workspacePath, conversationId, messages)`

### 1.2 History-aware prompt used by Intent Agent (classification/entity planning)

Inside `runAssistantPipeline(...)` the backend builds:

1. `lastMessages = messages.slice(-CHAT_HISTORY_LIMIT)`
2. `historyAwarePrompt`:
   - if `lastMessages` is not empty:
     - join turns as `User: ...` / `Assistant: ...`
     - append the current `prompt` as the final `User: ${prompt}`
   - else:
     - `historyAwarePrompt = prompt`

Then the backend calls the Intent Agent pipeline with **history-aware input**:
- `runIntentPipeline(historyAwarePrompt, { skipReasoning: true, cacheContext: {...} })`

Important: `skipReasoning: true` means:
- Intent Agent **does not build its own context bundle**
- Intent Agent **does not call its internal reasoner**
- The Intent Agent still does classification + entity extraction + task planning + context request building

### 1.3 Context Engine execution (real code retrieval + ranking)

The Intent Agent returns (at least) `intent`, `entities`, `tasks`, and a `contextRequest`:
- `intentResult.contextRequest` is built by `context-request-builder`

The backend then runs the Context Engine (real stores):

1. (Optional) trigger analysis indexing for fresh embeddings/metadata:
   - `runCodebaseAnalysisIfConfigured(...)`
2. Build raw context using the backend adapter:
   - `buildRawContext(repo_id, intentResult.contextRequest, adapter)`
3. Rank and pack to a token-budgeted context window:
   - `generateCandidates(rawContext)`
   - `computeCandidateScores(...)`
   - `combineScores(...)`
   - `selectTopK(...)`
   - `buildContextWindow(...)`

Output:
- `contextWindow.files`
- `contextWindow.functions`
- `contextWindow.snippets`
- `contextWindow.estimatedTokens`

### 1.4 Intent Reasoner (LLM) aligned to the Context Engine output

After `contextWindow` is computed, the backend calls:
- `runIntentReasoning(...)` (loaded from `@repo/intent-agent`)

But the key difference is **what gets passed as `context`**:
- `files` / `functions` come from `contextWindow`
- `classes` / `dependencies` are currently passed as empty (because the context engine’s window currently exposes only these fields)

So the Intent Reasoner LLM prompt is built from the same `contextWindow` that produced `response.context`.

---

## 2. What the Intent Agent returns (and how the backend uses it)

Intent Agent pipeline return shape (simplified):
- `intent`: `intentType`
- `entities`: extracted entities
- `tasks`: planned tasks
- `contextRequest`: the key output used by the Context Engine
- `response`: UI-facing intent summary (but in current backend wiring, reasoning is computed later)

The backend uses:
- `intentResult.intent.intentType` + summary
- `intentResult.entities.entities` as routing/scoring signals
- `intentResult.tasks` mainly to build `contextRequest`
- `intentResult.contextRequest` as the Context Engine query plan

Then the backend generates:
- `response.context` from `contextWindow`
- `response.reasoning` from calling the Intent Reasoner on the backend context window

---

## 3. Intent Agent modules (full internal breakdown)

The Intent Agent is implemented in `packages/agents/intent-agent`.
Pipeline entry:
- `packages/agents/intent-agent/pipeline/run-intent-pipeline.ts`

Modules:
1. `prompt-normalizer`
2. `intent-classifier`
3. `entity-extractor`
4. `task-planner`
5. `context-request-builder`
6. `context-builder-adapter` (skipped in current backend flow)
7. `intent-reasoner`
8. `intent-response`

---

## 4. Module 1 — Prompt Normalizer

### 4.1 Output type

`NormalizedPrompt` includes:
- `original`
- `normalized`
- `tokens`
- `references`

### 4.2 Steps (implemented in `modules/prompt-normalizer/normalize-prompt.ts`)

1. **Noise removal**
   - removes filler words like `pls`, `please`, `kindly`, `hey`, `can you`, etc.
   - collapses repeated punctuation

2. **Sentence case**
   - preserves the original internal casing after the first character (so camelCase function names still match later)

3. **Shorthand expansion** (`shorthand-expander.ts`)
   - example mappings:
     - `api` → `API`
     - `auth` → `authentication`
     - `func` → `function`
     - `svc` → `service`

4. **Reference detection** (`reference-detector.ts`)
   It identifies:
   - **File references** like `login.ts` using extension regex:
     - `ts|tsx|js|py|go|java`
   - **CamelCase functions** like `validatePassword`
   - **Simple lowercase identifiers** like `login` (explicitly added so prompts like “fix login api” still generate a `function` reference)
   - **Module keywords**: `auth`, `payment`, `billing`, `user`

5. **Tokenization**
   - lowercase tokens
   - removes stopwords (e.g. `the`, `a`, `an`, `in`, `to`, `for`, `of`)

### 4.3 Why this matters for the context engine

The normalizer produces `references`, and the entity extractor converts those references into structured entities. Those entities drive task planning and then the context request.

---

## 5. Module 2 — Intent Classifier (LLM)

### 5.1 Categories it classifies

The classifier outputs exactly one of these labels:
- `GENERIC`
- `CODE_FIX`
- `FEATURE_IMPLEMENTATION`
- `REFACTOR`
- `CODE_EXPLANATION`
- `CODE_SEARCH`
- `DEPENDENCY_ANALYSIS`
- `TEST_GENERATION`
- `SECURITY_ANALYSIS`
- `FILE_EDIT`
- `PROJECT_SETUP`

### 5.2 Intent classifier LLM SYSTEM prompt (exact text)

From `modules/intent-classifier/llm-intent-classifier.service.ts`:

```text
You are an intent classifier for a coding assistant. Given a user message, respond with exactly one of these labels:

- GENERIC: Greetings, small talk, thanks, or anything not related to code or the codebase (e.g. "Hi!", "How are you?", "Thanks").
- CODE_FIX: User wants to fix a bug, error, or broken behavior.
- FEATURE_IMPLEMENTATION: User wants to add, implement, or build something new.
- REFACTOR: User wants to refactor, improve, clean up, or simplify code.
- CODE_EXPLANATION: User wants an explanation of how something works or what something does.
- CODE_SEARCH: User wants to find or locate something in the codebase.
- DEPENDENCY_ANALYSIS: User asks about dependencies or imports.
- TEST_GENERATION: User wants tests or testing.
- SECURITY_ANALYSIS: User asks about security or vulnerabilities.
- FILE_EDIT: User wants to edit, modify, or change a file.
- PROJECT_SETUP: User asks about setup, configuration, or installation.

Respond with only the label, nothing else. No punctuation, no explanation.
```

### 5.3 User message given to the classifier

The classifier receives:
- `userMessage = prompt.normalized || prompt.original`

In current backend wiring, that `prompt` is the backend’s `historyAwarePrompt`.

### 5.4 Output

Returns:
- `{ intentType, confidence: 1, matchedKeywords: [] }`

---

## 6. Module 3 — Entity Extractor (rule-based)

### 6.1 Entity types

Extracted entity types:
- `file`
- `function`
- `class`
- `module`
- `service`
- `api`

### 6.2 What it extracts (implemented in `extract-entities.ts` + `entity-patterns.ts`)

From the normalized prompt text it combines:

1. **Reference-derived entities**
   - converts reference-detector outputs (`file`, `function`, `class`, `module`) into entities

2. **Pattern-based entities**
   - file entities:
     - `[\w-]+\.(ts|tsx|js|py|go|java)`
   - camelCase function entities:
     - `/\b[a-z]+[A-Z][a-zA-Z]*\b/g`
   - PascalCase class entities:
     - `/\b[A-Z][a-zA-Z]+\b/g`
   - API entities:
     - pattern: `([\w-]+) api`
     - stored with suffix “API” normalization
   - Module/Service entities:
     - pattern: `([\w-]+) module` and `([\w-]+) service`

3. **Deduplication**
   - merges and dedupes entities (`dedupeEntities`)

### 6.3 Why this matters

Entities drive:
- task planning (which task rules to use + what the tasks are about)
- context-request query terms (what to search symbols/embeddings for)

---

## 7. Module 4 — Task Planner (rules)

### 7.1 How tasks are chosen

Task types (`modules/task-planner/task-planner.types.ts`):
- `LOCATE_CODE`
- `ANALYZE_FLOW`
- `IDENTIFY_ISSUE`
- `GENERATE_PATCH`
- `EXPLAIN_CODE`
- `SEARCH_REFERENCES`

For each `intentType`, the planner selects a list of task types from:
- `modules/task-planner/task-rules.ts`

Current mapping (`TASK_RULES`) includes:
- `GENERIC: []`
- `CODE_FIX: [LOCATE_CODE, ANALYZE_FLOW, IDENTIFY_ISSUE, GENERATE_PATCH]`
- `FEATURE_IMPLEMENTATION: [LOCATE_CODE, ANALYZE_FLOW, GENERATE_PATCH]`
- `REFACTOR: [LOCATE_CODE, ANALYZE_FLOW, GENERATE_PATCH]`
- `CODE_EXPLANATION: [LOCATE_CODE, EXPLAIN_CODE]`
- `CODE_SEARCH: [SEARCH_REFERENCES]`
- `DEPENDENCY_ANALYSIS: [LOCATE_CODE, ANALYZE_FLOW]`
- `TEST_GENERATION: [LOCATE_CODE]`
- `SECURITY_ANALYSIS: [LOCATE_CODE, ANALYZE_FLOW]`
- `FILE_EDIT: [LOCATE_CODE, GENERATE_PATCH]`
- `PROJECT_SETUP: [ANALYZE_FLOW, GENERATE_PATCH]`

### 7.2 How task descriptions are built

In `plan-tasks.ts`, each task type is converted into:
- `description` (string)
- `entities: [primaryEntity.value]` (when applicable)

Examples:
- `LOCATE_CODE`:
  - `Locate implementation of ${primaryEntity.value}`
- `ANALYZE_FLOW`:
  - tries to choose module/service/api target and describes “Analyze X flow”
- `EXPLAIN_CODE`:
  - `Explain the behavior and purpose of ${primaryEntity.value}`

---

## 8. Module 5 — Context Request Builder (how intent becomes context queries)

### 8.1 Key output: `ContextRequest`

From `context-request.types.ts`:

- `symbolSearch?: string[]`
- `fileSearch?: string[]`
- `moduleSearch?: string[]`
- `embeddingSearch?: string[]`
- `dependencyLookup?: boolean`

### 8.2 How it decides which query terms to produce

Context request builder uses:
- `CONTEXT_QUERY_RULES` in `context-query-rules.ts`

Current mapping:
- `LOCATE_CODE: ["symbolSearch", "embeddingSearch"]`
- `ANALYZE_FLOW: ["dependencyLookup", "symbolSearch"]`
- `IDENTIFY_ISSUE: ["embeddingSearch", "dependencyLookup"]`
- `GENERATE_PATCH: ["symbolSearch", "embeddingSearch"]`
- `EXPLAIN_CODE: ["symbolSearch", "embeddingSearch"]`
- `SEARCH_REFERENCES: ["symbolSearch"]`

### 8.3 How “terms” are generated from entities

In `build-context-request.ts`:
- `symbolSearch` terms:
  - `taskEntityValues.map(toSymbolTerm)`
  - `toSymbolTerm(...)` takes first word and strips file extensions
- `fileSearch` terms:
  - only entities of type `file` are used
- `moduleSearch` terms:
  - module/service entities are used, with suffix stripping (`module`/`service`)
- `embeddingSearch` terms:
  - if task entities exist: use them
  - otherwise: use all entity values
- `dependencyLookup`:
  - becomes `true` when any strategy requests it

### 8.4 This is the handoff to the Context Engine

The backend runs:
- `buildRawContext(repo_id, intentResult.contextRequest, adapter)`

Meaning:
- the Intent Agent does planning + query selection
- the Context Engine does execution + ranking

---

## 9. Module 6 — Context Builder Adapter (intent-agent internal)

This module exists in the intent-agent package (`modules/context-builder-adapter`), but in the **current backend wiring**:
- the backend calls `runIntentPipeline(..., { skipReasoning: true })`
- so intent-agent does **not** execute `buildContext(...)`

Therefore, the intent-agent internal adapter is not responsible for the context retrieval in the current flow.

The real context retrieval happens in the backend via:
- `apps/backend/src/adapters/context-builder.adapter.ts`
- plus context-builder + context-ranking packages

---

## 10. Module 7 — Intent Reasoner (LLM)

The intent reasoner is implemented by two layers:
1. A system prompt (`llm-client.service.ts`)
2. A user prompt template (`reasoning-prompt-builder.ts`)

### 10.1 Intent Reasoner SYSTEM prompt (exact text)

From `modules/intent-reasoner/llm-client.service.ts`:

```text
You are a software architecture reasoning engine. Analyze the given context and respond with a JSON object containing: detectedComponents (string[]), missingComponents (string[]), potentialIssues (string[]), recommendedNextStep (string). Return only valid JSON, no markdown.
```

### 10.2 User prompt template (exact text)

From `modules/intent-reasoner/reasoning-prompt-builder.ts`:

```text
You are an expert software engineer analyzing a codebase.

USER REQUEST:
"${userPrompt.trim()}"

NORMALIZED INTENT (as hint):
Intent Type: ${intent.intentType}

ENTITIES:
${entityLines}

TASK PLAN:
${taskLines}

CODEBASE CONTEXT:

Files:
${fileLines}

Functions:
${functionLines}

Classes:
${classLines}

Dependencies:
${depLines}

---

YOUR TASK (${instruction}):

Given the USER REQUEST and the CODEBASE CONTEXT:

1. What is already implemented?
2. What is missing or incomplete?
3. What issues or bugs may exist?
4. What should be done next to satisfy the user's request?

---

Return ONLY valid JSON, no markdown or explanation:

{
  "detectedComponents": [],
  "missingComponents": [],
  "potentialIssues": [],
  "recommendedNextStep": ""
}
```

Where `instruction` depends on `intent.intentType`:
- `CODE_FIX`: “Focus on identifying bugs, errors, and what needs to be fixed.”
- `FEATURE_IMPLEMENTATION`: “Focus on missing components and implementation steps to fulfill the request.”
- `REFACTOR`: “Focus on improvement opportunities, duplication, and simplification.”
- `CODE_EXPLANATION`: “Focus on explaining existing logic clearly and what the user should understand.”
- `CODE_SEARCH`: “Focus on locating relevant code and where things are implemented.”
- `DEPENDENCY_ANALYSIS`: “Focus on dependency relationships and impact.”
- `TEST_GENERATION`: “Focus on test coverage gaps and what tests to add.”
- `SECURITY_ANALYSIS`: “Focus on security issues and vulnerabilities.”
- `FILE_EDIT` / `PROJECT_SETUP` / default (`GENERIC`): “Focus on what is in place, what is missing, and what should be done next.”

### 10.3 How backend injects context engine output into reasoning

In current backend wiring, the backend calls intent-agent’s `runReasoning(...)` with:
- `context.files = contextWindow.files`
- `context.functions = contextWindow.functions`
- `context.classes = []`
- `context.dependencies = []`

So `Files:` and `Functions:` in the reasoner prompt reflect the same context engine window that becomes `response.context`.

---

## 11. Module 8 — Intent Response (final structured summary)

`intent-response/generate-response.ts` builds `IntentResponse`:
- `intent` and a computed `summary`
- plus optional fields:
  - `relevantFiles` from context files (when present)
  - `detectedComponents`, `missingComponents`, `potentialIssues`, `recommendedNextStep` from reasoning

In the current backend wiring:
- the backend replaces reasoning with the reasoning computed from contextWindow
- so the final UI reasoning comes from the aligned backend reasoner call

---

## 12. Summary: the “contract” between Intent Agent and Context Engine

The Intent Agent’s “contract” with the Context Engine is:

1. **Intent Agent produces a `ContextRequest`**
   - based on:
     - intent classification (`intentType`)
     - entities extracted from the prompt
     - task planner rules (`TASK_RULES`)
     - query strategy rules (`CONTEXT_QUERY_RULES`)

2. **Context Engine executes the request and returns a `ContextWindow`**
   - ranked + token-budgeted

3. **Backend feeds ContextWindow into the Intent Reasoner**
   - so `response.reasoning` matches `response.context`

This resolves the architectural gap where reasoning and retrieved context could otherwise diverge.

