import type { DetectedReference } from "./prompt-normalizer.types";

const FILE_EXTENSIONS = ["ts", "tsx", "js", "py", "go", "java"];

const MODULE_KEYWORDS = ["auth", "payment", "billing", "user"];

const CAMEL_CASE_FUNCTION_REGEX = /\b[a-z]+[A-Z][a-zA-Z]*\b/g;

export function detectReferences(text: string): DetectedReference[] {
  const references: DetectedReference[] = [];

  // File references like login.ts
  const filePattern = new RegExp(
    `\\b[\\w-]+\\.(${FILE_EXTENSIONS.join("|")})\\b`,
    "g",
  );
  const fileMatches = text.match(filePattern);
  if (fileMatches) {
    for (const match of fileMatches) {
      references.push({
        type: "file",
        value: match,
      });
    }
  }

  // CamelCase function names like validatePassword
  const functionMatches = text.match(CAMEL_CASE_FUNCTION_REGEX);
  if (functionMatches) {
    for (const fn of functionMatches) {
      references.push({
        type: "function",
        value: fn,
      });
    }
  }

  // Module keywords
  for (const keyword of MODULE_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(text)) {
      references.push({
        type: "module",
        value: keyword,
      });
    }
  }

  return dedupeReferences(references);
}

function dedupeReferences(references: DetectedReference[]): DetectedReference[] {
  const seen = new Set<string>();
  const result: DetectedReference[] = [];

  for (const ref of references) {
    const key = `${ref.type}:${ref.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(ref);
    }
  }

  return result;
}

