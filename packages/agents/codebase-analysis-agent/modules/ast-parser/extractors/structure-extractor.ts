import type { ASTNode } from "../types/ast-parser.types";
import type { ExtractedMetadata, FunctionMetadata } from "../types/ast-parser.types";

/**
 * Convert character offset to 1-based line number.
 */
function offsetToLine(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

/**
 * Extract import specifiers from content (simple regex; can be replaced by parser-driven extraction).
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  const patterns = [
    /import\s+[\s{]*(\w+)/g,
    /import\s+[\s{]*\*\s+as\s+(\w+)/g,
    /require\s*\(\s*['"][^'"]+['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(content)) !== null && m[1]) {
      if (!imports.includes(m[1])) imports.push(m[1]);
    }
  }
  return imports;
}

/** Node types that represent functions (tree-sitter snake_case + legacy). */
const FUNCTION_NODE_TYPES = new Set([
  "function_declaration",
  "function_definition",
  "method_declaration",
  "method_definition",
  "FunctionDeclaration",
  "function",
]);

/**
 * Recursively collect function-like nodes with name, line range, and calls.
 */
function collectFunctions(
  nodes: ASTNode | ASTNode[],
  content: string
): FunctionMetadata[] {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  const out: FunctionMetadata[] = [];

  function visit(node: ASTNode): void {
    if (FUNCTION_NODE_TYPES.has(node.type) && node.name) {
      out.push({
        name: node.name,
        line_start: offsetToLine(content, node.start),
        line_end: offsetToLine(content, node.end),
        calls: node.calls ?? [],
      });
    }
    if (node.children) {
      for (const c of node.children) visit(c);
    }
  }

  for (const node of list) visit(node);
  return out;
}

/** Node types that represent classes (tree-sitter + legacy). */
const CLASS_NODE_TYPES = new Set([
  "class_declaration",
  "class_definition",
  "struct_item",
  "ClassDeclaration",
  "class",
]);

/**
 * Extract classes (class name) from AST/content for OOP languages.
 */
function collectClasses(nodes: ASTNode | ASTNode[], content: string): string[] {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  const classes: string[] = [];

  function visit(node: ASTNode): void {
    if (CLASS_NODE_TYPES.has(node.type) && node.name) {
      classes.push(node.name);
    }
    if (node.children) {
      for (const c of node.children) visit(c);
    }
  }

  for (const node of list) visit(node);
  return classes;
}

export interface StructureExtractorInput {
  repo_id: string;
  file: string;
  ast: ASTNode | ASTNode[];
  content: string;
}

/**
 * How the worker extracts useful elements from the AST (functions, classes, imports).
 * Output feeds the Metadata Publisher.
 */
export function extractStructure(input: StructureExtractorInput): ExtractedMetadata {
  const functions = collectFunctions(input.ast, input.content);
  const imports = extractImports(input.content);
  const classes = collectClasses(input.ast, input.content);

  return {
    repo_id: input.repo_id,
    file: input.file,
    functions,
    imports,
    ...(classes.length > 0 ? { classes } : {}),
  };
}
