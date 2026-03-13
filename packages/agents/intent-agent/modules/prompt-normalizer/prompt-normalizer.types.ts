export type DetectedReferenceType = "file" | "function" | "class" | "module";

export interface DetectedReference {
  type: DetectedReferenceType;
  value: string;
}

export interface NormalizedPrompt {
  original: string;
  normalized: string;
  tokens: string[];
  references: DetectedReference[];
}

