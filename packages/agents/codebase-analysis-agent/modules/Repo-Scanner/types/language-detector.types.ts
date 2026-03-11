/** Result of language detection for a single file (for File Classification / Job Generator) */
export interface FileWithLanguage {
  file: string;
  language: string;
}

export interface LanguageDetectorOptions {
  /** If true, read file content for shebang when extension is unknown or ambiguous */
  useShebang?: boolean;
  /** If true, use project config (package.json, go.mod, etc.) as fallback */
  useProjectConfig?: boolean;
}
