"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeEslint = analyzeEslint;
const path_1 = __importDefault(require("path"));
const LINTABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
/**
 * ESLint analyzer. Uses dynamic import so the app still runs if ESLint is not installed.
 */
async function analyzeEslint(rootDir, filePaths) {
    const toLint = filePaths.filter((p) => LINTABLE_EXT.test(p));
    if (toLint.length === 0)
        return new Map();
    try {
        const { ESLint } = await Promise.resolve().then(() => __importStar(require("eslint")));
        const eslint = new ESLint({ cwd: rootDir });
        const absPaths = toLint.map((f) => path_1.default.join(rootDir, f));
        const results = await eslint.lintFiles(absPaths);
        const byFile = new Map();
        for (const result of results) {
            const relPath = path_1.default.relative(rootDir, result.filePath);
            const normalized = relPath.split(path_1.default.sep).join("/");
            const list = (result.messages ?? []).map((m) => ({
                file: normalized,
                line: m.line ?? 1,
                column: m.column,
                message: m.message ?? "",
                severity: m.severity === 2 ? "error" : "warning",
                source: "eslint",
            }));
            if (list.length)
                byFile.set(normalized, list);
        }
        return byFile;
    }
    catch {
        return new Map();
    }
}
