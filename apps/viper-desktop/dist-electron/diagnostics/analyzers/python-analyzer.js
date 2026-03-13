"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzePython = analyzePython;
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
/** Run pyflakes on a single file and parse output into diagnostics. */
function analyzePython(rootDir, relPath, _content) {
    return new Promise((resolve) => {
        const absPath = path_1.default.join(rootDir, relPath);
        const proc = (0, child_process_1.spawn)("python", ["-m", "pyflakes", absPath], {
            cwd: rootDir,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const chunks = [];
        proc.stdout?.on("data", (chunk) => chunks.push(chunk));
        proc.stderr?.on("data", (chunk) => chunks.push(chunk));
        proc.on("error", () => resolve([]));
        proc.on("close", (code, signal) => {
            if (code === 0 && !signal) {
                resolve([]);
                return;
            }
            const out = Buffer.concat(chunks).toString("utf8");
            const diagnostics = parsePyflakesOutput(relPath, out);
            resolve(diagnostics);
        });
    });
}
/** Parse pyflakes stdout/stderr: "file:line:col: message" or "file:line: message". */
function parsePyflakesOutput(relPath, output) {
    const diagnostics = [];
    const lines = output.trim().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
        // path:line:col: message or path:line: message
        const match = line.match(/^[^:]+:(\d+):(?:\d+:)?\s*(.+)$/);
        if (match) {
            const lineNum = parseInt(match[1], 10);
            const message = match[2].trim();
            diagnostics.push({
                file: relPath,
                line: isNaN(lineNum) ? 1 : lineNum,
                message,
                severity: "error",
                source: "pyflakes",
            });
        }
    }
    return diagnostics;
}
