const FILLER_PATTERNS: RegExp[] = [
  /\bpls\b/gi,
  /\bplease\b/gi,
  /\bkindly\b/gi,
  /\bhey\b/gi,
  /\bcan you\b/gi,
  /\bcould you\b/gi,
  /\bwould you\b/gi,
];

const REPEATED_PUNCTUATION_PATTERN = /([!?.,])\1+/g;

export function removeNoise(text: string): string {
  let cleaned = text;

  for (const pattern of FILLER_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  cleaned = cleaned.replace(REPEATED_PUNCTUATION_PATTERN, "$1");

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

