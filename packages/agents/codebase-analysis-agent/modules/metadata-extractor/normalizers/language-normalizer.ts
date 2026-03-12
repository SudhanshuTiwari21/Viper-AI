import type { SerializedASTNode } from "../types/metadata-job.types";
import type { NormalizedNode, NormalizedNodeType } from "../types/metadata.types";

/** AST node types that map to "function". */
const FUNCTION_TYPES = new Set([
  "function_declaration",
  "function_definition",
  "method_declaration",
  "method_definition",
  "FunctionDeclaration",
  "function",
]);

/** AST node types that map to "class". */
const CLASS_TYPES = new Set([
  "class_declaration",
  "class_definition",
  "struct_item",
  "ClassDeclaration",
  "class",
]);

/** AST node types that map to "import". */
const IMPORT_TYPES = new Set([
  "import_statement",
  "import_declaration",
  "import",
]);

function mapToNormalizedType(astType: string): NormalizedNodeType | null {
  if (FUNCTION_TYPES.has(astType)) return "function";
  if (CLASS_TYPES.has(astType)) return "class";
  if (IMPORT_TYPES.has(astType)) return "import";
  return null;
}

/**
 * Normalize AST nodes to a unified schema (function, class, call, import).
 * Different languages produce different node types; this produces universal types.
 */
export function normalizeAst(
  ast: SerializedASTNode | SerializedASTNode[],
  file: string
): NormalizedNode[] {
  const result: NormalizedNode[] = [];
  const nodes = Array.isArray(ast) ? ast : [ast];

  function visit(node: SerializedASTNode): void {
    const normalizedType = mapToNormalizedType(node.type);
    if (normalizedType && node.name) {
      result.push({
        type: normalizedType,
        name: node.name,
        file,
        calls: node.calls,
      });
    }
    if (node.children) {
      for (const c of node.children) visit(c);
    }
  }

  for (const node of nodes) visit(node);
  return result;
}
