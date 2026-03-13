const SHORTHAND_MAP: Record<string, string> = {
  api: "API",
  auth: "authentication",
  db: "database",
  repo: "repository",
  func: "function",
  svc: "service",
  cfg: "configuration",
};

export function expandShorthand(text: string): string {
  if (!text) return text;

  return text.replace(/\b[a-zA-Z]+\b/g, (word) => {
    const lower = word.toLowerCase();
    const mapped = SHORTHAND_MAP[lower];
    return mapped ?? word;
  });
}

export { SHORTHAND_MAP };

