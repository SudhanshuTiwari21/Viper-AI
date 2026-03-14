# Codebase Analysis Agent

Developer-friendly overview of the **Codebase Analysis Agent**: structure, outputs, and how to use it.

---

## Purpose

The Codebase Analysis Agent turns a repository into **structured, queryable knowledge**: file inventory, AST metadata, dependency graph, and vector embeddings. Other agents (e.g. Intent Agent, Implementation Agent) use this data for context and search.

**No LLMs** — this agent is deterministic and pipeline-based (scan → parse → metadata → graph → embeddings).

---

## Code Structure

```
codebase-analysis-agent/
├── index.ts                 # Public API (single entrypoint)
├── types/
│   └── types.ts
├── modules/
│   ├── repo-scanner/        # 1. Walk repo, classify files, emit parse jobs
│   ├── ast-parser/          # 2. Parse source → AST, extract structure, publish jobs
│   ├── metadata-extractor/  # 3. Normalize AST, relationships, emit graph events
│   ├── dependency-graph-builder/  # 4. Build & persist knowledge graph
│   └── chunk-embedding-generator/ # 5. Chunk code, compute embeddings, index
├── tools/
│   └── git-tool/            # Clone, pull, checkout (for workspace setup)
└── tests/
    └── repo-scanner/
```

---

## Pipeline Flow (Conceptual)

```
runRepoScanner(workspace)
    → File walk, language detection, module detection, file classification
    → RepoScanPipelineResult + ParseJob[] (for AST workers)

ParseJob[] (e.g. from Redis)
    → startASTParserWorkers / AST workers consume jobs
    → Parse source → extract structure → publish metadata jobs

MetadataJob[] (e.g. from Redis)
    → startMetadataExtractionWorkers / runMetadataPipeline
    → Normalize nodes, resolve symbols, emit dependency-graph events

Dependency graph events (Redis channel)
    → startGraphBuilderWorkers / runGraphBuilderPipeline
    → Build graph (nodes + edges), persist (e.g. Postgres)

Embedding jobs (Redis channel)
    → startEmbeddingWorkers / runEmbeddingPipeline
    → Chunk code, compute vectors, write to vector store
```

Modules can be run as **workers** (consuming Redis queues) or as **one-off pipelines** (in-process), depending on how you wire them.

---

## Modules in Detail

### 1. Repo Scanner (`modules/repo-scanner`)

**Role:** Turn a workspace path into a file list with language, module, and type (source vs generated, etc.).

**Main API:** `runRepoScanner(input, options?)`  
**Input:** `RunRepoScannerInput` — `repo_id`, `workspacePath`, optional `branch`  
**Output:** `RepoScanPipelineResult`

| Field | Description |
|-------|-------------|
| `files` | `ScannedFileEntry[]` — each file with `file`, `language`, `module`, `type` |
| `sourceFiles` | Subset of files classified as source (for AST parsing) |
| `jobs` | `ParseJob[]` — one per source file (`repo`, `file`, `language`, `module`) |

Optional `persistMetadata` adapter can persist repo + file list (e.g. to DB) before jobs are generated.

**Helpers:** `resolveWorkspace`, `repoMetadataStoreService`, `WorkspaceNotFoundError`.

---

### 2. AST Parser (`modules/ast-parser`)

**Role:** Parse source files (Tree-sitter), extract functions/classes/structure, and publish metadata jobs (or write to store).

**Main API:**  
- `startASTParserWorkers(options)` — start workers that consume a Redis parse queue.  
- Workers read `ParseJob`, parse file, extract `ExtractedMetadata`, then publish to metadata queue or store.

**Outputs (per file):**  
- `ParsedFile` / `SerializedAST`  
- `ExtractedMetadata` — `functions`, `classes`, etc.  
- Jobs pushed to metadata-extractor queue (or equivalent).

**Config:** `DEFAULT_AST_PARSE_QUEUE_NAME`, `DEFAULT_METADATA_EXTRACT_QUEUE_NAME`.  
**Languages:** `SUPPORTED_LANGUAGES`, `getParserForLanguage`, `isTreeSitterSupported`.

---

### 3. Metadata Extractor (`modules/metadata-extractor`)

**Role:** Normalize AST into a unified schema, resolve symbols, build relationship edges, and emit events for the dependency-graph builder.

**Main API:**  
- `startMetadataExtractionWorkers(options)` — workers consume AST/metadata jobs.  
- `runMetadataPipeline(...)` — run extraction in-process.

**Outputs:**  
- `NormalizedNode`, `RelationshipEdge`, `ResolvedSymbol`  
- Events on `DEPENDENCY_GRAPH_BUILD_CHANNEL` (Redis) for graph builder.

**Types:** `MetadataJob`, `NormalizedNodeType`, `RelationshipType`, `ClassMetadata`, `ImportMetadata`, etc.

---

### 4. Dependency Graph Builder (`modules/dependency-graph-builder`)

**Role:** Consume metadata events, build a **knowledge graph** (nodes = functions/classes/files/modules; edges = CALLS, IMPORTS, EXTENDS, etc.), and persist it.

**Main API:**  
- `startGraphBuilderWorkers(options)` — workers subscribe to channel and build graph.  
- `runGraphBuilderPipeline(job, options)` — build graph in-process for a given job.

**Outputs:**  
- **Graph:** `GraphNode` (id, type, file, module, repo_id, name), `GraphEdge` (from, to, type, repo_id).  
- Persisted via `GraphStoreAdapter` (e.g. `PostgresGraphStoreAdapter`).  
- Events on `GRAPH_UPDATED_CHANNEL` for downstream (e.g. embedding indexer).

**Types:** `GraphNodeType`, `GraphEdgeType`, `NormalizedGraphNode`, `GraphBuildJob`, `GraphStoreAdapter`.

---

### 5. Chunk Embedding Generator (`modules/chunk-embedding-generator`)

**Role:** Chunk code (function/class/file_summary/module_summary), compute embeddings, and write to a vector store for semantic search.

**Main API:**  
- `startEmbeddingWorkers(options)` — workers consume embedding jobs (e.g. from Redis).  
- `runEmbeddingPipeline(job, options)` — run chunking + embedding in-process.

**Outputs:**  
- **Chunks:** `Chunk` — `chunk_id`, `file`, `module`, `symbol`, `type`, `content`, `repo_id`.  
- **Vectors:** `VectorRecord` — `id`, `vector`, `repo_id`, `file`, `module`, `symbol`, `metadata`.  
- Stored via `VectorStoreAdapter`; events on `INDEX_UPDATED_CHANNEL` if needed.

**Types:** `ChunkType`, `EmbeddingGenerateJob`, `EmbeddingModelAdapter`, `VectorStoreAdapter`, `IndexUpdatedEvent`.

---

## Tools

### Git Tool (`tools/git-tool`)

- `cloneRepository(repoUrl, workspacePath)` — clone into workspace (or `~/.viper/workspaces`).  
- `pullRepository(workspacePath)` — pull latest.  
- `checkoutBranch(workspacePath, branch)` — checkout branch.

Used by orchestrators to prepare a workspace before running `runRepoScanner`.

---

## Output Summary (What the agent “produces”)

| Stage | Output |
|-------|--------|
| Repo Scanner | `RepoScanPipelineResult`: file list with language/module/type, `ParseJob[]` for AST |
| AST Parser | Parsed AST, `ExtractedMetadata` (functions, classes), jobs to metadata queue |
| Metadata Extractor | `NormalizedNode` + `RelationshipEdge`, events for graph builder |
| Dependency Graph | `GraphNode` + `GraphEdge` in store (e.g. Postgres), `GRAPH_UPDATED_CHANNEL` |
| Embeddings | `Chunk` + `VectorRecord` in vector store, optional `INDEX_UPDATED_CHANNEL` |

---

## Usage Example

```ts
import {
  runRepoScanner,
  startASTParserWorkers,
  runMetadataPipeline,
  runGraphBuilderPipeline,
  runEmbeddingPipeline,
  cloneRepository,
} from "@repo/codebase-analysis-agent";

// 1. Prepare workspace (optional)
await cloneRepository("https://github.com/org/repo.git", "~/workspaces/repo");

// 2. Scan repo → files + parse jobs
const scan = await runRepoScanner({
  repo_id: "my-repo",
  workspacePath: "/path/to/workspace",
});
// scan.files, scan.sourceFiles, scan.jobs

// 3. Start workers (or run pipelines in-process with scan.jobs)
// startASTParserWorkers({ ... });
// runMetadataPipeline(...);
// runGraphBuilderPipeline(...);
// runEmbeddingPipeline(...);
```

---

## Scripts

- `pnpm test` — run tests (e.g. `tests/repo-scanner`)  
- `pnpm run check-types` — TypeScript check  
- `pnpm run lint` — ESLint  

---

## Dependencies

- **ioredis** — queues and pub/sub between modules  
- **tree-sitter** + language grammars — AST parsing (TypeScript, JavaScript, Python, Go, Rust, Java, C++, C#)

Graph and vector stores are **adapter-based** (e.g. Postgres, Qdrant); implement the interfaces and pass them into the pipeline/worker options.
