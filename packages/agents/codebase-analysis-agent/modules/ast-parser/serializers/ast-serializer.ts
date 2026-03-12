import type { ASTNode, SerializedAST } from "../types/ast-parser.types";

/**
 * Convert AST node to a portable JSON-serializable shape.
 */
export function serializeNode(node: ASTNode): SerializedAST {
  const out: SerializedAST = {
    type: node.type,
    start: node.start,
    end: node.end,
  };
  if (node.name != null) out.name = node.name;
  if (node.calls != null && node.calls.length > 0) out.calls = node.calls;
  if (node.children != null && node.children.length > 0) {
    out.children = node.children.map(serializeNode);
  }
  return out;
}

/**
 * Serialize root AST (single node or array of nodes) to portable format.
 */
export function serializeAST(ast: ASTNode | ASTNode[]): SerializedAST | SerializedAST[] {
  if (Array.isArray(ast)) {
    return ast.map(serializeNode);
  }
  return serializeNode(ast);
}
