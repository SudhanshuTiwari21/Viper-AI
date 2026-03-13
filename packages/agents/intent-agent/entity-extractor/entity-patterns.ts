import type { ExtractedEntity } from "./entity-extractor.types";

const FILE_REGEX = /\b[\w-]+\.(ts|tsx|js|py|go|java)\b/gi;
const CAMEL_CASE_FUNCTION_REGEX = /\b[a-z]+[A-Z][a-zA-Z]*\b/g;
const PASCAL_CASE_CLASS_REGEX = /\b[A-Z][a-zA-Z]+\b/g;
const API_REGEX = /\b([\w-]+)\s+api\b/gi;
const MODULE_SERVICE_REGEX = /\b([\w-]+)\s+(module|service)\b/gi;

export function extractFileEntities(text: string): ExtractedEntity[] {
  return collectMatches(FILE_REGEX, text, (match) => ({
    type: "file",
    value: match,
  }));
}

export function extractFunctionEntities(text: string): ExtractedEntity[] {
  return collectMatches(CAMEL_CASE_FUNCTION_REGEX, text, (match) => ({
    type: "function",
    value: match,
  }));
}

export function extractClassEntities(text: string): ExtractedEntity[] {
  return collectMatches(PASCAL_CASE_CLASS_REGEX, text, (match) => ({
    type: "class",
    value: match,
  }));
}

export function extractApiEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  let match: RegExpExecArray | null;

  while ((match = API_REGEX.exec(text)) !== null) {
    const full = match[0];
    entities.push({
      type: "api",
      value: normalizePhrase(full, "API"),
    });
  }

  return entities;
}

export function extractModuleAndServiceEntities(
  text: string,
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  let match: RegExpExecArray | null;

  while ((match = MODULE_SERVICE_REGEX.exec(text)) !== null) {
    const name = match[1];
    const kind = match[2].toLowerCase();
    const phrase = `${name} ${kind}`;

    if (kind === "module") {
      entities.push({ type: "module", value: phrase });
    } else if (kind === "service") {
      entities.push({ type: "service", value: phrase });
    }
  }

  return entities;
}

function collectMatches(
  regex: RegExp,
  text: string,
  toEntity: (match: string) => ExtractedEntity,
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  let match: RegExpExecArray | null;

  const globalRegex =
    regex.global || regex.sticky || regex.unicode ? regex : new RegExp(regex, regex.flags + "g");
  globalRegex.lastIndex = 0;

  while ((match = globalRegex.exec(text)) !== null) {
    entities.push(toEntity(match[0]));
  }

  return entities;
}

function normalizePhrase(phrase: string, suffixUpper: string): string {
  const lower = phrase.toLowerCase();
  const suffix = suffixUpper.toLowerCase();
  if (lower.endsWith(` ${suffix}`)) {
    const base = phrase.slice(0, phrase.length - suffix.length - 1);
    return `${base} ${suffixUpper}`;
  }
  return phrase;
}

