import * as fs from "fs/promises";
import * as path from "path";
import type { ASTNode } from "../types/ast-parser.types";
import { getParserForLanguage, isTreeSitterSupported } from "./language-router";
import { parseWithTreeSitter } from "./tree-sitter-engine";

export interface ParserEngineOptions {
  /** Resolve repo name to filesystem root. */
  getRepoRoot: (repo: string) => string;
}

/**
 * Parser engine: Tree-sitter for supported languages (top 8), heuristic fallback for others.
 * Ensures dependency graph, metadata extraction, and embeddings get real ASTs where possible.
 */
export class ParserEngine {
  private readonly getRepoRoot: (repo: string) => string;

  constructor(options: ParserEngineOptions) {
    this.getRepoRoot = options.getRepoRoot;
  }

  /**
   * Resolve full path and read file content.
   */
  async readFile(repo: string, file: string): Promise<string> {
    const root = this.getRepoRoot(repo);
    const fullPath = path.join(root, file);
    return fs.readFile(fullPath, "utf-8");
  }

  /**
   * Generate AST: Tree-sitter for TypeScript, JavaScript, Python, Go, Rust, Java, C++, C#;
   * otherwise fallback heuristic (regex) for unknown languages.
   */
  async generateAST(
    repo: string,
    file: string,
    language: string,
    content: string
  ): Promise<ASTNode | ASTNode[]> {
    const normalizedLang = language.toLowerCase().replace(/\s+/g, "");

    if (isTreeSitterSupported(normalizedLang)) {
      try {
        const root = parseWithTreeSitter(content, normalizedLang);
        return root;
      } catch (err) {
        // Syntax errors or parser failure: fall back to heuristic so the job doesn't fail
        return this.fallbackHeuristicParse(content);
      }
    }

    return this.fallbackHeuristicParse(content);
  }

  /**
   * Fallback for unsupported languages or parse errors. Best-effort only; not for graph building.
   */
  private fallbackHeuristicParse(content: string): ASTNode {
    const lines = content.split("\n");
    const totalLength = content.length;
    const root: ASTNode = {
      type: "program",
      start: 0,
      end: totalLength,
      children: this.extractSimpleDeclarations(content, lines),
    };
    return root;
  }

  /**
   * Simple heuristic extraction when no tree-sitter grammar is available.
   */
  private extractSimpleDeclarations(
    content: string,
    lines: string[]
  ): ASTNode[] {
    const nodes: ASTNode[] = [];
    const functionRegex = /(?:function|const|let|var)\s+(\w+)|(?:def)\s+(\w+)|(?:func)\s+(\w+)/g;
    let offset = 0;
    for (const line of lines) {
      let m: RegExpExecArray | null;
      functionRegex.lastIndex = 0;
      while ((m = functionRegex.exec(line)) !== null) {
        const name = m[1] ?? m[2] ?? m[3] ?? "anonymous";
        const start = offset + (m.index ?? 0);
        const end = start + (m[0]?.length ?? 0);
        const callMatch = line.match(/(\w+)\s*\(/g);
        nodes.push({
          type: "function_declaration",
          name,
          start,
          end,
          calls: callMatch ? callMatch.map((c) => c.replace(/\s*\($/, "")) : [],
        });
      }
      offset += line.length + 1;
    }
    return nodes;
  }
}
