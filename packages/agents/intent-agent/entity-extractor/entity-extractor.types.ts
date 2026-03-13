export type EntityType =
  | "file"
  | "function"
  | "class"
  | "module"
  | "service"
  | "api";

export interface ExtractedEntity {
  type: EntityType;
  value: string;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
}

