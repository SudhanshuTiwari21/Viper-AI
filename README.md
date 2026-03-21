# Viper AI

Viper AI is an AI coding agent platform with project-aware planning and execution.

It combines:
- AI Powered coding Agent IDE
- project management-oriented workflows

## Core Pipeline

```text
User Prompt
  -> Intent Agent
  -> Planner Agent
  -> Execution Engine
      -> Context Tools
      -> Implementation Agent
  -> Code Changes
```

## Architecture

### Agent Packages

- `@repo/intent-agent`: prompt normalization, intent classification, entity extraction
- `@repo/planner-agent`: deterministic execution plan generation from intent + entities
- `@repo/execution-engine`: step runner and tool dispatch system
- `@repo/implementation-agent`: code generation, patch creation, file writing, validation
- `@repo/codebase-analysis-agent`: repository scanning/analysis pipeline

### Context Stack

- `@repo/context-builder`: raw context retrieval (symbols, embeddings, dependencies)
- `@repo/context-ranking`: scoring, ranking, context window building
- `@repo/database`: persistence layer utilities

### Apps

- `@repo/backend`: Fastify API and orchestration runtime
- `web-app`: Next.js app
- `viper-desktop`: Electron + Vite desktop client

## Repository Structure

```text
apps/
  backend/
  web-app/
  viper-desktop/

packages/
  agents/
    intent-agent/
    planner-agent/
    execution-engine/
    implementation-agent/
    codebase-analysis-agent/
  context-builder/
  context-ranking/
  database/
  shared/
```

## Getting Started

### 1) Install dependencies

```sh
npm install
```

### 2) Configure environment

Create `.env` at repo root (see `docs/ENV.md` and `.env.example` if present).

Common variables:
- `OPENAI_API_KEY` for LLM-powered reasoning/code generation
- `DATABASE_URL` (defaults to `postgresql://localhost:5432/viper`)
- `QDRANT_URL` (optional, defaults to `http://localhost:6333`)

### 3) Run the system

Run all workspaces:

```sh
npm run dev
```

Run backend only:

```sh
npm run dev --workspace=@repo/backend
```

## Useful Commands

From repo root:

```sh
# Build all packages/apps
npm run build

# Type-check all packages/apps
npm run check-types

# Format repository
npm run format
```

Workspace examples:

```sh
# Backend tests
npm run test --workspace=@repo/backend

# Intent agent tests
npm run test --workspace=@repo/intent-agent

# Planner agent tests
npm run test --workspace=@repo/planner-agent

# Execution engine tests
npm run test --workspace=@repo/execution-engine

# Implementation agent tests
npm run test --workspace=@repo/implementation-agent
```

## Product Direction

Viper AI is evolving from assistant-style responses to a full AI IDE runtime:
- deterministic planning
- step-wise execution
- safe patching + file updates
- future: rollback, patch preview, streaming execution, and deeper project management automation

## Notes

- This is an active monorepo under rapid iteration.
- Backward-compatible adapters may exist while interfaces migrate between agent stages.
- See `docs/` for architecture and rollout plans.
