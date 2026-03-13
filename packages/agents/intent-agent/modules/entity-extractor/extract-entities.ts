import type { NormalizedPrompt } from "../prompt-normalizer/prompt-normalizer.types";
import type { EntityExtractionResult, ExtractedEntity } from "./entity-extractor.types";
import type { DetectedReference } from "../prompt-normalizer/prompt-normalizer.types";
import {
  extractApiEntities,
  extractClassEntities,
  extractFileEntities,
  extractFunctionEntities,
  extractModuleAndServiceEntities,
} from "./entity-patterns";
import { detectReferences } from "../prompt-normalizer/reference-detector";
import { dedupeEntities } from "./entity-scoring";

export function extractEntities(prompt: NormalizedPrompt): EntityExtractionResult {
  const text = prompt.normalized;

  const fromReferences = mapReferencesToEntities(detectReferences(text));

  const fromPatterns: ExtractedEntity[] = [
    ...extractFileEntities(text),
    ...extractFunctionEntities(text),
    ...extractClassEntities(text),
    ...extractApiEntities(text),
    ...extractModuleAndServiceEntities(text),
  ];

  const combined = [...fromReferences, ...fromPatterns];

  return {
    entities: dedupeEntities(combined),
  };
}

function mapReferencesToEntities(references: DetectedReference[]): ExtractedEntity[] {
  return references
    .map<ExtractedEntity | null>((ref) => {
      switch (ref.type) {
        case "file":
          return { type: "file", value: ref.value };
        case "function":
          return { type: "function", value: ref.value };
        case "class":
          return { type: "class", value: ref.value };
        case "module":
          return { type: "module", value: ref.value };
        default:
          return null;
      }
    })
    .filter((e): e is ExtractedEntity => e !== null);
}

