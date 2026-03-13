"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeGeneric = analyzeGeneric;
const TODO_FIXME = /\b(TODO|FIXME|XXX|HACK)\b/gi;
/**
 * Fallback analyzer: no language-specific tooling.
 * Detects TODO/FIXME-style comments as warnings.
 */
function analyzeGeneric(filePath, content) {
    const diagnostics = [];
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(TODO_FIXME);
        if (match) {
            diagnostics.push({
                file: filePath,
                line: i + 1,
                column: line.indexOf(match[0]) + 1,
                message: `Comment "${match[0]}" found`,
                severity: "info",
                source: "generic",
            });
        }
    }
    return diagnostics;
}
