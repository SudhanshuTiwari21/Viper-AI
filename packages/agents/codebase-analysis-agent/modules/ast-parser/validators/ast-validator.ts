import type { ASTNode } from "../types/ast-parser.types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates AST: syntax errors, missing nodes, parser completeness.
 */
export function validateAST(ast: ASTNode | ASTNode[]): ValidationResult {
  const errors: string[] = [];
  const nodes = Array.isArray(ast) ? ast : [ast];

  for (const node of nodes) {
    if (!node.type) {
      errors.push("Missing node type");
    }
    if (typeof node.start !== "number" || typeof node.end !== "number") {
      errors.push("Missing or invalid start/end positions");
    }
    if (node.start > node.end) {
      errors.push("Invalid range: start > end");
    }
    if (node.children) {
      const childResult = validateAST(node.children);
      if (!childResult.valid) {
        errors.push(...childResult.errors);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
