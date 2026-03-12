/**
 * Incoming job from embedding_generate.request Redis channel.
 */
export interface EmbeddingGenerateJob {
  repo_id: string;
  file: string;
  module: string;
  symbol?: string;
  content: string;
}
