/** Classification type for pipeline: source → AST, test → optional, config → architecture, docs → RAG, generated → ignore */
export enum FileType {
  SOURCE = "source",
  TEST = "test",
  CONFIG = "config",
  DOCUMENTATION = "documentation",
  GENERATED = "generated",
  OTHER = "other",
}

/** Result of file classification for a single file (for Job Generator) */
export interface FileWithType {
  file: string;
  type: FileType;
}
