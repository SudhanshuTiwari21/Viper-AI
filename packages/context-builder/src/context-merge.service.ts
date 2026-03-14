/**
 * Context merge service: combines and deduplicates raw context results.
 * No ranking, filtering, or limiting — only normalization and merge.
 */

import type {
  AdapterSymbolSearchResult,
  AdapterEmbeddingMatch,
  AdapterDependencyEdge,
} from "./raw-context.types.js";
import type {
  FileContext,
  FunctionContext,
  ClassContext,
  EmbeddingMatch,
  DependencyEdge,
  RawContextBundle,
} from "./raw-context.types.js";

/**
 * Derives module from file path (e.g. "auth/login.ts" → "auth").
 */
function moduleFromFile(file: string): string | undefined {
  const idx = file.indexOf("/");
  if (idx <= 0) return undefined;
  return file.slice(0, idx);
}

/**
 * Normalize adapter symbol results into FileContext, FunctionContext, ClassContext.
 * Deduplicates by (file), (name, file), (name, file) respectively.
 */
export function normalizeSymbolResults(
  results: AdapterSymbolSearchResult[],
): {
  files: FileContext[];
  functions: FunctionContext[];
  classes: ClassContext[];
} {
  const fileMap = new Map<string, FileContext>();
  const functionMap = new Map<string, FunctionContext>();
  const classMap = new Map<string, ClassContext>();

  for (const r of results) {
    const file = r.filePath;
    const module = moduleFromFile(file);

    if (file && !fileMap.has(file)) {
      fileMap.set(file, { file, module });
    }

    if (r.kind === "function") {
      const key = `${r.symbolName}\0${file}`;
      if (!functionMap.has(key)) {
        functionMap.set(key, { name: r.symbolName, file, module });
      }
    } else if (r.kind === "class") {
      const key = `${r.symbolName}\0${file}`;
      if (!classMap.has(key)) {
        classMap.set(key, { name: r.symbolName, file, module });
      }
    }
  }

  return {
    files: [...fileMap.values()],
    functions: [...functionMap.values()],
    classes: [...classMap.values()],
  };
}

/**
 * Normalize adapter embedding matches into EmbeddingMatch.
 * Deduplicates by (file, content, score) to avoid identical entries.
 */
export function normalizeEmbeddingResults(
  results: AdapterEmbeddingMatch[],
): EmbeddingMatch[] {
  const seen = new Set<string>();
  const out: EmbeddingMatch[] = [];

  for (const m of results) {
    const file = m.file ?? "";
    const content = m.text;
    const key = `${file}\0${content}\0${m.score}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      file,
      symbol: m.symbol,
      content,
      score: m.score,
    });
  }

  return out;
}

/**
 * Normalize adapter dependency edges into DependencyEdge.
 * Adds default type "REFERENCES" when missing. Deduplicates by (from, to).
 */
export function normalizeDependencyEdges(
  results: AdapterDependencyEdge[],
): DependencyEdge[] {
  const seen = new Set<string>();
  const out: DependencyEdge[] = [];

  for (const e of results) {
    const key = `${e.from}\0${e.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ from: e.from, to: e.to, type: e.type ?? "REFERENCES" });
  }

  return out;
}

/**
 * Merge multiple partial raw context collections into a single RawContextBundle.
 * Deduplicates: files by file path; functions by name+file; classes by name+file;
 * embeddings by file+content; dependencies by from+to.
 */
export function mergeRawContext(
  repo_id: string,
  parts: Array<{
    files?: FileContext[];
    functions?: FunctionContext[];
    classes?: ClassContext[];
    embeddings?: EmbeddingMatch[];
    dependencies?: DependencyEdge[];
  }>,
): RawContextBundle {
  const fileMap = new Map<string, FileContext>();
  const functionMap = new Map<string, FunctionContext>();
  const classMap = new Map<string, ClassContext>();
  const embeddingKeys = new Set<string>();
  const embeddings: EmbeddingMatch[] = [];
  const dependencyKeys = new Set<string>();
  const dependencies: DependencyEdge[] = [];

  for (const part of parts) {
    for (const f of part.files ?? []) {
      if (f.file && !fileMap.has(f.file)) {
        fileMap.set(f.file, f);
      }
    }
    for (const f of part.functions ?? []) {
      const key = `${f.name}\0${f.file}`;
      if (!functionMap.has(key)) functionMap.set(key, f);
    }
    for (const c of part.classes ?? []) {
      const key = `${c.name}\0${c.file}`;
      if (!classMap.has(key)) classMap.set(key, c);
    }
    for (const e of part.embeddings ?? []) {
      const key = `${e.file}\0${e.content}\0${e.score}`;
      if (!embeddingKeys.has(key)) {
        embeddingKeys.add(key);
        embeddings.push(e);
      }
      if (e.file && !fileMap.has(e.file)) {
        fileMap.set(e.file, { file: e.file, module: moduleFromFile(e.file) });
      }
    }
    for (const d of part.dependencies ?? []) {
      const key = `${d.from}\0${d.to}`;
      if (!dependencyKeys.has(key)) {
        dependencyKeys.add(key);
        dependencies.push(d);
      }
    }
  }

  return {
    repo_id,
    files: [...fileMap.values()],
    functions: [...functionMap.values()],
    classes: [...classMap.values()],
    embeddings,
    dependencies,
  };
}
