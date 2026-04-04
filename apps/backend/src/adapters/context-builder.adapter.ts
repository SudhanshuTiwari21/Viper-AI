/**
 * Real context adapter: Postgres (graph_nodes, graph_edges) + Qdrant (vector search).
 * Implements ContextBuilderAdapter for buildRawContext in the assistant pipeline.
 */
import type { Pool } from "pg";
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import type {
  ContextBuilderAdapter,
  AdapterSymbolSearchResult,
  AdapterEmbeddingMatch,
  AdapterDependencyEdge,
} from "@repo/context-builder";

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION ?? "viper_code";
const SEARCH_LIMIT = 20;

/** Test / observability alignment — same values as used in `searchEmbeddings`. */
export const CONTEXT_ADAPTER_QDRANT_COLLECTION = QDRANT_COLLECTION;
export const CONTEXT_ADAPTER_EMBEDDING_SEARCH_LIMIT = SEARCH_LIMIT;

export interface ContextAdapterOptions {
  repo_id: string;
  pool: Pool;
  qdrantUrl: string;
  openaiApiKey: string;
}

/**
 * Create an adapter that talks to DB (graph_nodes, graph_edges) and Qdrant for the given repo.
 */
export function createContextAdapter(options: ContextAdapterOptions): ContextBuilderAdapter {
  const { repo_id, pool, qdrantUrl, openaiApiKey } = options;
  const openai = new OpenAI({ apiKey: openaiApiKey });
  const qdrant = new QdrantClient({ url: qdrantUrl });

  return {
    async searchSymbols(term: string): Promise<AdapterSymbolSearchResult[]> {
      if (!term.trim()) return [];
      const pattern = `%${term.trim().replace(/%/g, "\\%")}%`;
      const result = await pool.query<{
        id: string;
        type: string | null;
        name: string | null;
        file: string | null;
      }>(
        `SELECT id, type, name, file FROM graph_nodes
         WHERE repo_id = $1 AND type IN ('function', 'class')
         AND (name ILIKE $2 OR file ILIKE $2)
         LIMIT 50`,
        [repo_id, pattern],
      );
      return result.rows
        .filter((r) => r.name && r.file)
        .map((r) => ({
          filePath: r.file!,
          symbolName: r.name!,
          kind: (r.type === "class" ? "class" : "function") as "function" | "class",
        }));
    },

    async searchEmbeddings(term: string): Promise<AdapterEmbeddingMatch[]> {
      if (!term.trim()) return [];
      try {
        const embeddingRes = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: term.trim(),
        });
        const vector = embeddingRes.data[0]?.embedding;
        if (!vector?.length) return [];

        const list = await qdrant.getCollections();
        const exists = list.collections?.some((c) => c.name === QDRANT_COLLECTION);
        if (!exists) return [];

        const results = await qdrant.search(QDRANT_COLLECTION, {
          vector,
          limit: SEARCH_LIMIT,
          with_payload: true,
          filter: {
            must: [{ key: "repo_id", match: { value: repo_id } }],
          },
        });

        return (results ?? []).map((p) => {
          const payload = (p.payload ?? {}) as Record<string, unknown>;
          const file = String(payload.file ?? "");
          const sym = payload.symbol != null ? String(payload.symbol) : undefined;
          const chunkId = String(payload.chunk_id ?? "");
          const text = file ? (sym ? `${file} (${sym})` : file) : chunkId || "[chunk]";
          return {
            text,
            score: p.score ?? 0,
            file: file || undefined,
            symbol: sym,
          };
        });
      } catch (err) {
        if (process.env.NODE_ENV !== "test") {
          console.error("[Viper] Context adapter searchEmbeddings error", err);
        }
        return [];
      }
    },

    async getDependencies(symbol: string): Promise<AdapterDependencyEdge[]> {
      if (!symbol.trim()) return [];
      const result = await pool.query<{ from_node: string; to_node: string; type: string | null }>(
        `SELECT from_node, to_node, type FROM graph_edges
         WHERE repo_id = $1 AND (from_node = $2 OR to_node = $2)
         LIMIT 100`,
        [repo_id, symbol.trim()],
      );
      return result.rows.map((r) => ({
        from: r.from_node,
        to: r.to_node,
        type: r.type ?? "REFERENCES",
      }));
    },
  };
}
