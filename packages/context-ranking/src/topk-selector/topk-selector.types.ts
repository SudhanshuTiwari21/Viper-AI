export interface RankedSnippet {
  file: string;
  content: string;
  score: number;
}

export interface RankedContextBundle {
  files: string[];
  functions: string[];
  snippets: RankedSnippet[];
}
