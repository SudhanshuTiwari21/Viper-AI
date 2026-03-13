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
exports.analyzeTypeScript = analyzeTypeScript;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const TS_EXT = /\.(ts|tsx)$/i;
/**
 * TypeScript analyzer using the TypeScript compiler API.
 * Discovers tsconfig.json, creates a program, and returns getPreEmitDiagnostics().
 */
async function analyzeTypeScript(rootDir, filePaths) {
    try {
        const ts = await Promise.resolve().then(() => __importStar(require("typescript")));
        const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, "tsconfig.json");
        if (!configPath)
            return new Map();
        const configText = fs_1.default.readFileSync(configPath, "utf8");
        const configFile = ts.readConfigFile(configPath, () => configText);
        if (configFile.error)
            return new Map();
        const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path_1.default.dirname(configPath));
        const tsFiles = filePaths.filter((p) => TS_EXT.test(p));
        if (tsFiles.length === 0)
            return new Map();
        const program = ts.createProgram(tsFiles.map((f) => path_1.default.join(rootDir, f)), parsed.options);
        const allDiagnostics = ts.getPreEmitDiagnostics(program);
        const byFile = new Map();
        for (const d of allDiagnostics) {
            const file = d.file;
            if (!file || !d.messageText)
                continue;
            let relPath = path_1.default.relative(rootDir, file.fileName);
            if (path_1.default.sep !== "/")
                relPath = relPath.split(path_1.default.sep).join("/");
            if (!filePaths.includes(relPath))
                continue;
            const message = typeof d.messageText === "string"
                ? d.messageText
                : d.messageText.messageText;
            const severity = d.category === ts.DiagnosticCategory.Error ? "error" : "warning";
            const start = file.getLineAndCharacterOfPosition(d.start ?? 0);
            const list = byFile.get(relPath) ?? [];
            list.push({
                file: relPath,
                line: start.line + 1,
                column: start.character + 1,
                message: String(message),
                severity,
                source: "typescript",
            });
            byFile.set(relPath, list);
        }
        return byFile;
    }
    catch {
        return new Map();
    }
}
