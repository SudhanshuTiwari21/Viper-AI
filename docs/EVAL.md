# Eval Harness — G.41

Offline-capable evaluation harness and release quality gates for ViperAI.

## Quick start

```bash
# Run the offline eval suite from the repo root:
npm run eval

# Full quality gate (type-check + unit tests + eval):
npm run quality-gate

# From inside the package:
cd packages/eval-harness
npx tsx src/run.ts
npx tsx src/run.ts --output eval-results.json
```

## What the eval harness tests

The harness runs **deterministic (Tier A) cases only** — no LLM calls, no API key required.

| Domain | Fixture file | What it tests | Source |
|---|---|---|---|
| Privacy path decisions | `fixtures/privacy-glob.json` | `checkPrivacy()` from `@repo/workspace-tools` | G.40 |
| Intent keyword scoring | `fixtures/intent-scoring.json` | `scoreIntents()` from `@repo/intent-agent` | core |
| Schema validation | `fixtures/schema-validation.json` | `ChatMode` and `ModelTier` Zod enum acceptance | C.11 / D.19 |
| Workflow stage registry | `fixtures/workflow-stages.json` | Critical stage names must be registered | A.1+ |

## Fixture format

Each file in `fixtures/` is a JSON object:

```json
{
  "type": "privacy-glob",
  "cases": [
    {
      "id": "priv-001",
      "description": "top-level .env is blocked",
      "tier": "offline",
      "input": { "relativePath": ".env" },
      "expect": { "allowed": false, "blockedByPrefix": "builtin:" }
    }
  ]
}
```

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"privacy-glob" \| "intent-scoring" \| "schema-validation" \| "workflow-stage"` | Yes | Selects the runner |
| `cases[].id` | `string` | Yes | Unique stable identifier (used in output table) |
| `cases[].description` | `string` | Yes | Human-readable label |
| `cases[].tier` | `"offline" \| "live"` | No | Defaults to `"offline"` |
| `cases[].input` | object | Yes | Type-specific (see below) |
| `cases[].expect` | object | Yes | Type-specific (see below) |

### Input / expect shapes per type

#### `privacy-glob`
```json
{
  "input": {
    "relativePath": "path/relative/to/workspace",
    "configDenyGlobs": ["**/custom/**"],
    "configAllowGlobs": ["custom/ok.json"]
  },
  "expect": {
    "allowed": true,
    "blockedByPrefix": "builtin:"
  }
}
```
- `configDenyGlobs` / `configAllowGlobs` — optional; simulates `.viper/privacy.json` config.
- `blockedByPrefix` — optional; if set, the `blockedBy` field must start with this prefix.

#### `intent-scoring`
```json
{
  "input": { "tokens": ["fix", "the", "bug"] },
  "expect": { "intentType": "CODE_FIX", "minConfidence": 0.1 }
}
```
- `tokens` — pre-tokenised words (lowercase). **Note:** `scoreIntents` does single-token keyword matching; multi-word phrases like `"next steps"` won't match individual tokens.
- `minConfidence` — optional lower bound on the confidence score (0–1).

#### `schema-validation`
```json
{
  "input": { "schema": "ChatMode", "value": "ask" },
  "expect": { "valid": true }
}
```
- `schema` — `"ChatMode"` or `"ModelTier"` (inline Zod mirrors of the production schemas).

#### `workflow-stage`
```json
{
  "input": { "stage": "privacy:path:blocked" },
  "expect": { "present": true }
}
```
- The runner checks against `REQUIRED_WORKFLOW_STAGES` in `src/runners/workflow-stage.runner.ts`. Update that set when new critical stages are added.

## Configuration — `eval.config.json`

```json
{
  "tiers": {
    "offline": { "required_pass_rate": 1.0 },
    "live":    { "required_pass_rate": 0.8 }
  },
  "timeout_ms": 30000
}
```

- `offline.required_pass_rate = 1.0` — all offline cases must pass. This is the release gate.
- `live.required_pass_rate` — applies to optional LLM-judged cases (not enforced by `quality-gate` by default).

## Release quality gate

```bash
npm run quality-gate
```

The gate runs in **fail-fast order** and exits non-zero if any step fails:

1. `check-types` for `@repo/workspace-tools` and `@repo/backend`
2. Unit tests: `@repo/workspace-tools`, `@repo/database`, `@repo/backend`, `@repo/eval-harness`
3. Eval: `npm run eval` (offline tier, 100% pass rate required)

**Expected runtime:** < 2 minutes on a typical laptop (all offline — no network calls).

**What blocks a release:**
- TypeScript errors in workspace-tools or backend.
- Any failing unit test in workspace-tools, database, or backend.
- Any offline eval case failing (pass rate < 100%).

## Adding new cases

1. Open the relevant fixture file (or create a new one).
2. Add a case with a unique `id`, clear `description`, and correct `input`/`expect`.
3. Run `npm run eval` to verify the new case passes.
4. If adding a new `type`, implement a runner in `src/runners/`, register it in `src/runner.ts`, and add the new type to `src/types.ts`.

## Tier B — LLM-judged cases (optional)

Not implemented in G.41 MVP. To enable:

1. Set `VIPER_EVAL_USE_LLM=1` and `OPENAI_API_KEY` in the environment.
2. Add cases with `"tier": "live"` to a fixture file.
3. Implement an `llm-response` runner that calls the backend and checks the response against rubric patterns (substring, regex, JSON schema).
4. The `quality-gate` script does NOT enforce the live tier by default — add a separate `npm run eval:live` script if wanted.

## Rollback

To revert G.41:
- Remove `packages/eval-harness/` entirely.
- Remove `npm run eval`, `npm run eval:offline`, and `npm run quality-gate` from root `package.json`.
- Remove `scoreIntents` and `INTENT_KEYWORD_RULES` exports from `packages/agents/intent-agent/index.ts`.
- Remove this file (`docs/EVAL.md`).
