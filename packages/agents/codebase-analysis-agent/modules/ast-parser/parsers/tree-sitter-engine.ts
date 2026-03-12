/**
 * Tree-sitter parser engine: loads grammars lazily and converts parse trees to our ASTNode shape.
 * Supports the Viper AI v1 top-8 languages: TypeScript, JavaScript, Python, Go, Rust, Java, C++, C#.
 */

import Parser from "tree-sitter";
import type { ASTNode } from "../types/ast-parser.types";
import { isTreeSitterSupported, type SupportedLanguageKey } from "./language-router";

type SyntaxNode = Parser.SyntaxNode;
type ParserLanguage = Parser.Language;

const grammarLoaders: Record<
  SupportedLanguageKey,
  () => { language: ParserLanguage; name?: string }
> = {
  typescript: () => {
    const ts = require("tree-sitter-typescript");
    return { language: ts.typescript };
  },
  javascript: () => {
    const js = require("tree-sitter-javascript");
    return { language: js };
  },
  python: () => {
    const py = require("tree-sitter-python");
    return { language: py };
  },
  go: () => {
    const go = require("tree-sitter-go");
    return { language: go };
  },
  rust: () => {
    const rust = require("tree-sitter-rust");
    return { language: rust };
  },
  java: () => {
    const java = require("tree-sitter-java");
    return { language: java };
  },
  cpp: () => {
    const cpp = require("tree-sitter-cpp");
    return { language: cpp };
  },
  csharp: () => {
    const cs = require("tree-sitter-c-sharp");
    return { language: cs };
  },
};

/** Node types we treat as function-like (have a name and optional body with calls). */
const FUNCTION_LIKE_TYPES = new Set([
  "function_declaration",
  "function_definition",
  "method_declaration",
  "method_definition",
  "arrow_function",
  "function_expression",
]);

/** Node types we treat as class declarations. */
const CLASS_LIKE_TYPES = new Set([
  "class_declaration",
  "class_definition",
  "struct_item",
]);

/** Get the name of a function-like or class-like node from its children (name, identifier, declarator). */
function getNodeName(node: SyntaxNode, source: string): string | undefined {
  const nameNode =
    node.childForFieldName("name") ??
    node.childForFieldName("declarator")?.childForFieldName("name") ??
    node.namedChild(0);
  if (!nameNode) return undefined;
  const text = source.slice(nameNode.startIndex, nameNode.endIndex).trim();
  return text || undefined;
}

/** Collect call targets (identifiers) from call_expression nodes under this node. */
function collectCallsFromBody(node: SyntaxNode, source: string): string[] {
  const calls: string[] = [];
  const body = node.childForFieldName("body");
  if (!body) return calls;

  function visit(n: SyntaxNode): void {
    if (n.type === "call_expression" || n.type === "call") {
      const fn = n.childForFieldName("function") ?? n.namedChild(0);
      if (fn) {
        const text = source.slice(fn.startIndex, fn.endIndex).trim();
        if (text && !calls.includes(text)) calls.push(text);
      }
    }
    for (let i = 0; i < n.childCount; i++) {
      const c = n.child(i);
      if (c) visit(c);
    }
  }
  visit(body);
  return calls;
}

/** Convert a tree-sitter SyntaxNode to our ASTNode. */
function tsNodeToAstNode(node: SyntaxNode, source: string): ASTNode {
  const start = node.startIndex;
  const end = node.endIndex;
  const type = node.type;
  const astNode: ASTNode = { type, start, end };

  if (FUNCTION_LIKE_TYPES.has(type)) {
    const name = getNodeName(node, source);
    if (name) astNode.name = name;
    const calls = collectCallsFromBody(node, source);
    if (calls.length > 0) astNode.calls = calls;
  } else if (CLASS_LIKE_TYPES.has(type)) {
    const name = getNodeName(node, source);
    if (name) astNode.name = name;
  }

  const children: ASTNode[] = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type !== "comment" && child.type !== "line_comment" && child.type !== "block_comment") {
      children.push(tsNodeToAstNode(child, source));
    }
  }
  if (children.length > 0) astNode.children = children;

  return astNode;
}

let defaultParser: Parser | null = null;

function getParser(): Parser {
  if (!defaultParser) defaultParser = new Parser();
  return defaultParser;
}

/**
 * Parse source code with the appropriate tree-sitter grammar for the language.
 * Returns our ASTNode tree. Use only for languages in SUPPORTED_LANGUAGES (top 8).
 */
export function parseWithTreeSitter(
  source: string,
  language: string
): ASTNode {
  const key = language.toLowerCase().replace(/\s+/g, "") as SupportedLanguageKey;
  if (!isTreeSitterSupported(key)) {
    throw new Error(`Tree-sitter does not support language: ${language}`);
  }
  const loader = grammarLoaders[key];
  if (!loader) {
    throw new Error(`No grammar loader for: ${key}`);
  }
  const { language: lang } = loader();
  const parser = getParser();
  parser.setLanguage(lang);
  const tree = parser.parse(source);
  const root = tree.rootNode;
  if (!root) {
    return { type: "program", start: 0, end: source.length, children: [] };
  }
  return tsNodeToAstNode(root, source);
}
