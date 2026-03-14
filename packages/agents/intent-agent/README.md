# Intent Agent

Developer-friendly overview of the **Intent Agent**: structure, data flow, outputs, and how to use it.

---

## Purpose

The Intent Agent takes a **raw user prompt** (e.g. from IDE chat) and returns a **structured intent response**: what the user wants to do, which parts of the codebase are relevant, what’s already there, what’s missing, and what to do next. It uses a mix of **rule-based** steps (normalize, classify, extract entities, plan tasks, build context request) and an **LLM-backed reasoning** step (optional) to analyze context and produce the final message.

---

## Code Structure

```
intent-agent/
├── index.ts                 # Public API (single entrypoint)
├── pipeline/
│   ├── run-intent-pipeline.ts   # Orchestrator: prompt → response
│   ├── intent-pipeline.types.ts # IntentPipelineResult
│   ├── intent-pipeline.test.ts
│   └── index.ts
└── modules/
    ├── prompt-normalizer/       # 1. Clean & normalize prompt, detect references
    ├── intent-classifier/        # 2. Classify intent (CODE_FIX, REFACTOR, etc.)
    ├── entity-extractor/        # 3. Extract files, modules, functions, APIs
    ├── task-planner/            # 4. Map intent + entities → planned tasks
    ├── context-request-builder/ # 5. Map tasks + entities → context queries
    ├── context-builder-adapter/ # 6. Execute context queries (symbols, embeddings, deps)
    ├── intent-reasoner/         # 7. LLM: analyze context → detected/missing/issues
    └── intent-response/         # 8. Build final IntentResponse for UI
```

---

## Pipeline Flow

```
User prompt (string)
    → normalizePrompt(prompt)           → NormalizedPrompt
    → classifyIntent(normalizedPrompt)  → IntentClassification
    → extractEntities(normalizedPrompt)→ EntityExtractionResult
    → planTasks(intent, entities)       → TaskPlan
    → buildContextRequest(tasks, entities) → ContextRequest
    → buildContext(contextRequest)      → ContextBundle (async; uses codebase data)
    → runReasoning(intent, entities, tasks, contextBundle) → IntentReasoning (async; LLM)
    → generateIntentResponse(...)      → IntentResponse
```

**Single entrypoint:** `runIntentPipeline(prompt: string)` returns `Promise<IntentPipelineResult>` with every intermediate result plus the final `response`.

---

## Modules in Detail

### 1. Prompt Normalizer (`modules/prompt-normalizer`)

**Role:** Clean and standardize the raw prompt; no LLM.

- **Input:** `string`  
- **Output:** `NormalizedPrompt` — `original`, `normalized`, `tokens`, `references`

**Steps:**  
- Remove noise (e.g. “pls”, “please”, “can you”).  
- Normalize casing (sentence case).  
- Expand shorthand (e.g. `api` → `API`, `auth` → `authentication`, `svc` → `service`).  
- Detect code references: files (`*.ts`, `*.tsx`, …), camelCase functions, PascalCase classes, modules.  
- Tokenize and drop stopwords.

**Example:** `"fix login api pls"` → normalized `"Fix login API"`, tokens `["fix","login","api"]`, references e.g. `[{ type: "function", value: "login" }]`.

---

### 2. Intent Classifier (`modules/intent-classifier`)

**Role:** Decide what kind of task the user wants; rule-based keyword scoring.

- **Input:** `NormalizedPrompt`  
- **Output:** `IntentClassification` — `intentType`, `confidence`, `matchedKeywords`

**Intent types:**  
`CODE_FIX`, `FEATURE_IMPLEMENTATION`, `REFACTOR`, `CODE_EXPLANATION`, `CODE_SEARCH`, `DEPENDENCY_ANALYSIS`, `TEST_GENERATION`, `SECURITY_ANALYSIS`, `FILE_EDIT`, `PROJECT_SETUP`.

**Example:** tokens `["fix","login","api"]` → `intentType: "CODE_FIX"`, `confidence: 0.33`.

---

### 3. Entity Extractor (`modules/entity-extractor`)

**Role:** Pull out code-related entities from the normalized prompt.

- **Input:** `NormalizedPrompt`  
- **Output:** `EntityExtractionResult` — `entities: ExtractedEntity[]`

**Entity types:** `file`, `function`, `class`, `module`, `service`, `api`.  
Uses regex/heuristics + prompt-normalizer references (e.g. file paths, camelCase/PascalCase, “X module”, “X API”).

**Example:** `"Fix login API in auth service"` → `[{ type: "api", value: "login API" }, { type: "service", value: "auth service" }]`.

---

### 4. Task Planner (`modules/task-planner`)

**Role:** Turn intent + entities into an ordered list of engineering tasks.

- **Input:** `IntentClassification`, `EntityExtractionResult`  
- **Output:** `TaskPlan` — `intent`, `tasks: PlannedTask[]`

**Task types:**  
`LOCATE_CODE`, `ANALYZE_FLOW`, `IDENTIFY_ISSUE`, `GENERATE_PATCH`, `EXPLAIN_CODE`, `SEARCH_REFERENCES`.

**Example:** `CODE_FIX` + entity “login API” → tasks like “Locate implementation of login API”, “Analyze authentication flow”, “Identify cause of bug”, “Prepare code modification”.

---

### 5. Context Request Builder (`modules/context-request-builder`)

**Role:** Turn the task plan + entities into a single **context query** for the codebase.

- **Input:** `TaskPlan`, `EntityExtractionResult`  
- **Output:** `ContextRequest` — `symbolSearch?`, `fileSearch?`, `moduleSearch?`, `embeddingSearch?`, `dependencyLookup?`

**Example:** LOCATE_CODE + “login API” → `symbolSearch: ["login"]`, `embeddingSearch: ["login API"]`; ANALYZE_FLOW → `dependencyLookup: true`.

---

### 6. Context Builder Adapter (`modules/context-builder-adapter`)

**Role:** Run the context request against real data (symbol store, vector DB, dependency graph) and return a **context bundle**.

- **Input:** `ContextRequest`  
- **Output:** `ContextBundle` — `files?`, `functions?`, `classes?`, `dependencies?`, `embeddingMatches?`

**Services (stub/implemented per env):**  
- `searchSymbols(term)` → functions/classes (e.g. from Postgres).  
- `searchEmbeddings(term)` → semantic matches (e.g. from vector DB).  
- `getDependencies(symbol)` → graph edges (e.g. from dependency store).

---

### 7. Intent Reasoner (`modules/intent-reasoner`)

**Role:** Use an LLM to analyze the context and summarize what exists, what’s missing, and what might be wrong.

- **Input:** `IntentClassification`, `EntityExtractionResult`, `TaskPlan`, `ContextBundle`  
- **Output:** `IntentReasoning` — `detectedComponents`, `missingComponents`, `potentialIssues`, `recommendedNextStep?`

**Flow:** Build a structured prompt from intent/entities/tasks/context → call `runReasoningPrompt(prompt)` (LLM client) → parse response into `IntentReasoning`. Currently the LLM client can be mocked or wired to OpenAI/local.

---

### 8. Intent Response (`modules/intent-response`)

**Role:** Build the final object shown in the IDE (summary, files, reasoning).

- **Input:** All of the above (intent, entities, tasks, contextBundle, reasoning).  
- **Output:** `IntentResponse`

**Fields:**  
- `intent` — intent type string.  
- `summary` — short human-readable summary.  
- `relevantFiles?` — from `ContextBundle.files`.  
- `detectedComponents?`, `missingComponents?`, `potentialIssues?`, `recommendedNextStep?` — from `IntentReasoning`.

---

## Main Types

| Type | Description |
|------|-------------|
| `NormalizedPrompt` | `original`, `normalized`, `tokens`, `references` |
| `IntentClassification` | `intentType`, `confidence`, `matchedKeywords` |
| `EntityExtractionResult` | `entities: { type, value }[]` |
| `TaskPlan` | `intent`, `tasks: { type, description, entities? }[]` |
| `ContextRequest` | `symbolSearch?`, `fileSearch?`, `moduleSearch?`, `embeddingSearch?`, `dependencyLookup?` |
| `ContextBundle` | `files?`, `functions?`, `classes?`, `dependencies?`, `embeddingMatches?` |
| `IntentReasoning` | `detectedComponents`, `missingComponents`, `potentialIssues`, `recommendedNextStep?` |
| `IntentResponse` | `intent`, `summary`, `relevantFiles?`, `detectedComponents?`, `missingComponents?`, `potentialIssues?`, `recommendedNextStep?` |
| `IntentPipelineResult` | All of the above (full pipeline output). |

---

## Output Summary (What the agent “produces”)

The **primary consumer-facing output** is `IntentResponse` (and its fields on `IntentPipelineResult.response`):

- **intent** — e.g. `"CODE_FIX"`.  
- **summary** — one-line summary (intent + entities + task count).  
- **relevantFiles** — paths from context (symbol/embedding/dependency lookups).  
- **detectedComponents** — what the reasoner found (e.g. “loginUser”, “auth/login.ts”).  
- **missingComponents** — what the reasoner thinks is missing.  
- **potentialIssues** — what might be wrong.  
- **recommendedNextStep** — suggested next action (e.g. “Implementation agent can generate patch”).

The rest of `IntentPipelineResult` is for debugging, downstream agents, or UI that wants to show intermediate steps.

---

## Usage Example

```ts
import { runIntentPipeline } from "@agents/intent-agent";

const result = await runIntentPipeline("fix login api pls");

console.log(result.response.intent);       // "CODE_FIX"
console.log(result.response.summary);      // "Intent: CODE_FIX. Entities: ..."
console.log(result.response.relevantFiles); // e.g. ["auth/login.ts"]
console.log(result.response.detectedComponents);
console.log(result.response.recommendedNextStep);
```

Using individual modules (e.g. for testing or custom flows):

```ts
import {
  normalizePrompt,
  classifyIntent,
  extractEntities,
  planTasks,
  buildContextRequest,
  buildContext,
  runReasoning,
  generateIntentResponse,
} from "@agents/intent-agent";
```

---

## Design Notes

- **Deterministic (no LLM):** normalizer, classifier, entity extractor, task planner, context-request builder.  
- **Async / external:** context-builder-adapter (symbol/embedding/dependency backends), intent-reasoner (LLM).  
- **Extensible:** Shorthand maps, intent keyword rules, task rules, and context-query rules are in separate files so they can be extended or overridden without changing core logic.

---

## Tests

- **pipeline:** `pipeline/intent-pipeline.test.ts` — mocks `buildContext` and `runReasoning`; checks full pipeline and intent classification.  
- **modules:** Each module has a `*.test.ts` (e.g. `prompt-normalizer.test.ts`, `intent-classifier.test.ts`) for its own behavior.

Run tests from the repo root or the `packages/agents/intent-agent` directory with your test runner (e.g. `pnpm test` or `vitest`).
