/**
 * Converts RawContextBundle into a uniform list of ContextCandidate.
 * Dependencies are not converted; they are used later by the ranking engine.
 * No ranking, scoring, or filtering — only conversion and deduplication by id.
 */

import type { RawContextBundle } from "@repo/context-builder";
import type { ContextCandidate } from "./candidate.types.js";

/**
 * Generate a deduplicated list of ContextCandidate from RawContextBundle.
 * Files → file candidates; functions → function candidates; classes → class candidates;
 * embeddings → chunk candidates. Dependencies are ignored.
 */
export function generateCandidates(raw: RawContextBundle): ContextCandidate[] {
  const byId = new Map<string, ContextCandidate>();

  const add = (c: ContextCandidate) => {
    if (!byId.has(c.id)) {
      byId.set(c.id, c);
    }
  };

  const { repo_id } = raw;

  for (const f of raw.files) {
    add({
      id: f.file,
      type: "file",
      repo_id,
      file: f.file,
      module: f.module,
    });
  }

  for (const fn of raw.functions) {
    const id = `function:${fn.file}:${fn.name}`;
    add({
      id,
      type: "function",
      repo_id,
      file: fn.file,
      symbol: fn.name,
      module: fn.module,
    });
  }

  for (const c of raw.classes) {
    const id = `class:${c.file}:${c.name}`;
    add({
      id,
      type: "class",
      repo_id,
      file: c.file,
      symbol: c.name,
      module: c.module,
    });
  }

  for (const e of raw.embeddings) {
    const id = `chunk:${e.file}:${e.content}`;
    add({
      id,
      type: "chunk",
      repo_id,
      file: e.file,
      symbol: e.symbol,
      content: e.content,
    });
  }

  return [...byId.values()];
}
