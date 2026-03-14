/**
 * Unified ranking entity used by the Context Ranking System.
 * All raw context (files, functions, classes, chunks) is converted into
 * this single abstraction for scoring. No ranking or scoring in this module.
 */

export type ContextCandidateType = "file" | "function" | "class" | "chunk";

export interface ContextCandidate {
  id: string;
  type: ContextCandidateType;
  repo_id: string;
  file?: string;
  symbol?: string;
  module?: string;
  content?: string;
}
