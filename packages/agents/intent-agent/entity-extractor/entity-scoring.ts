import type { ExtractedEntity } from "./entity-extractor.types";

export function dedupeEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Set<string>();
  const result: ExtractedEntity[] = [];

  for (const entity of entities) {
    const key = `${entity.type}:${entity.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(entity);
    }
  }

  return result;
}

