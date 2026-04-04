import type OpenAI from "openai";
import {
  readWorkspaceFile,
  listWorkspaceDirectory,
  searchWorkspaceText,
  searchWorkspaceFiles,
  editWorkspaceFile,
  createWorkspaceFile,
  runWorkspaceCommand,
} from "@repo/workspace-tools";
import type { AgenticToolDefinition } from "../loop/agentic-loop.types.js";

export interface WorkspaceToolCallbacks {
  onCommandOutput?: (chunk: string) => void;
  canEdit?: (
    toolName: "edit_file" | "create_file",
    path: string,
  ) => { allowed: true } | { allowed: false; reason: string };
}

/**
 * Builds the set of workspace tools available to the agentic loop,
 * bound to a specific workspacePath.
 */
export function buildWorkspaceTools(
  workspacePath: string,
  callbacks?: WorkspaceToolCallbacks,
): AgenticToolDefinition[] {
  return [
    {
      definition: {
        type: "function",
        function: {
          name: "read_file",
          description:
            "Read the contents of a file in the user's workspace. Returns the file content, line count, and whether it was truncated. Use this to examine source code, config files, READMEs, etc.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description:
                  "Relative path from the workspace root (e.g. 'src/index.ts', 'package.json')",
              },
            },
            required: ["path"],
          },
        },
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        const result = await readWorkspaceFile(workspacePath, path);
        if (!result) return `File not found or unreadable: ${path}`;
        const header = `${path} (${result.lines} lines, ${result.sizeBytes} bytes${result.truncated ? ", truncated to 50KB" : ""})`;
        return `--- ${header} ---\n${result.content}`;
      },
    },
    {
      definition: {
        type: "function",
        function: {
          name: "list_directory",
          description:
            "List files and directories in the user's workspace. Returns the directory tree with file sizes. Use this to understand the project structure before reading specific files.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description:
                  "Relative path from the workspace root (e.g. '.', 'src', 'src/components'). Defaults to '.' (project root).",
              },
              max_depth: {
                type: "number",
                description: "Maximum depth to recurse (default 3).",
              },
            },
            required: [],
          },
        },
      },
      execute: async (args) => {
        const dir = String(args.path ?? ".");
        const maxDepth = typeof args.max_depth === "number" ? args.max_depth : 3;
        const result = await listWorkspaceDirectory(workspacePath, dir, {
          maxDepth,
          maxEntries: 150,
        });
        if (result.entries.length === 0) return `No entries found in ${dir}`;
        const lines = result.entries.map((e) => {
          if (e.type === "directory") return `${e.name}/`;
          const size = e.sizeBytes != null ? ` (${e.sizeBytes} bytes)` : "";
          return `${e.name}${size}`;
        });
        const suffix = result.truncated ? "\n[... listing truncated]" : "";
        return lines.join("\n") + suffix;
      },
    },
    {
      definition: {
        type: "function",
        function: {
          name: "search_text",
          description:
            "Search for a text pattern across files in the workspace. Returns matching lines with file paths and line numbers. Use this to find usages, TODOs, function definitions, imports, etc.",
          parameters: {
            type: "object",
            properties: {
              pattern: {
                type: "string",
                description: "Text pattern to search for (case-insensitive by default).",
              },
              glob: {
                type: "string",
                description:
                  "Optional file extension filter (e.g. '*.ts', '*.py'). Only files matching this pattern are searched.",
              },
            },
            required: ["pattern"],
          },
        },
      },
      execute: async (args) => {
        const pattern = String(args.pattern ?? "");
        if (!pattern) return "No search pattern provided.";
        const glob = args.glob ? String(args.glob) : undefined;
        const result = await searchWorkspaceText(workspacePath, pattern, {
          glob,
          maxMatches: 40,
        });
        if (result.matches.length === 0) {
          return `No matches for "${pattern}" in ${result.filesSearched} files searched.`;
        }
        const lines = result.matches.map(
          (m) => `${m.file}:${m.line}: ${m.content}`,
        );
        const suffix = result.truncated ? "\n[... results truncated]" : "";
        return `${result.matches.length} matches in ${result.filesSearched} files:\n${lines.join("\n")}${suffix}`;
      },
    },
    {
      definition: {
        type: "function",
        function: {
          name: "search_files",
          description:
            "Find files in the workspace by name pattern. Returns a list of matching file paths. Use this to find specific files like tests, configs, or source files.",
          parameters: {
            type: "object",
            properties: {
              pattern: {
                type: "string",
                description:
                  "File name pattern (e.g. '*.test.ts', 'package.json', '*.css').",
              },
            },
            required: ["pattern"],
          },
        },
      },
      execute: async (args) => {
        const pattern = String(args.pattern ?? "");
        if (!pattern) return "No pattern provided.";
        const result = await searchWorkspaceFiles(workspacePath, pattern, 80);
        if (result.files.length === 0) return `No files matching "${pattern}".`;
        const suffix = result.truncated ? "\n[... results truncated]" : "";
        return `${result.files.length} files:\n${result.files.join("\n")}${suffix}`;
      },
    },
    {
      definition: {
        type: "function",
        function: {
          name: "edit_file",
          description:
            "Edit a file by replacing a specific text snippet with new text. The old_text must be an EXACT match of text currently in the file (including whitespace and indentation). Use read_file first to see the current contents.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Relative path from the workspace root.",
              },
              old_text: {
                type: "string",
                description:
                  "The exact text to find and replace. Must match exactly one location in the file.",
              },
              new_text: {
                type: "string",
                description: "The replacement text.",
              },
            },
            required: ["path", "old_text", "new_text"],
          },
        },
      },
      pausesLoop: true,
      execute: async (args) => {
        const path = String(args.path ?? "");
        const oldText = String(args.old_text ?? "");
        const newText = String(args.new_text ?? "");
        const gate = callbacks?.canEdit?.("edit_file", path);
        if (gate && !gate.allowed) {
          return `Edit blocked by policy: ${gate.reason}`;
        }
        if (!path) return "No file path provided.";
        if (!oldText) return "No old_text provided.";
        const result = await editWorkspaceFile(workspacePath, path, oldText, newText);
        if (!result.success) return `Edit failed: ${result.error}`;
        return `Successfully edited ${result.file} (${result.linesChanged! >= 0 ? "+" : ""}${result.linesChanged} lines)\nContext around edit:\n${result.contextSnippet}`;
      },
    },
    {
      definition: {
        type: "function",
        function: {
          name: "create_file",
          description:
            "Create a new file in the workspace with the given content. Parent directories are created automatically. If the file already exists, it will be overwritten.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Relative path from the workspace root for the new file.",
              },
              content: {
                type: "string",
                description: "The full content of the new file.",
              },
            },
            required: ["path", "content"],
          },
        },
      },
      pausesLoop: true,
      execute: async (args) => {
        const path = String(args.path ?? "");
        const content = String(args.content ?? "");
        const gate = callbacks?.canEdit?.("create_file", path);
        if (gate && !gate.allowed) {
          return `Create blocked by policy: ${gate.reason}`;
        }
        if (!path) return "No file path provided.";
        const result = await createWorkspaceFile(workspacePath, path, content);
        if (!result.success) return `Create failed: ${result.error}`;
        const verb = result.overwritten ? "Overwrote" : "Created";
        return `${verb} ${result.file} (${result.lines} lines)`;
      },
    },
    {
      definition: {
        type: "function",
        function: {
          name: "run_command",
          description:
            "Run a shell command in the user's workspace directory. Use this for: installing packages (npm install), running tests (npm test), building the project (npm run build), checking types (npx tsc --noEmit), running linters, git commands, or any other CLI tool. The command runs with a 30-second timeout. Output (stdout + stderr) is returned.",
          parameters: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description:
                  "The shell command to execute (e.g. 'npm install', 'npm test', 'git status', 'npx tsc --noEmit').",
              },
            },
            required: ["command"],
          },
        },
      },
      execute: async (args) => {
        const command = String(args.command ?? "");
        if (!command) return "No command provided.";
        const result = await runWorkspaceCommand(workspacePath, command, undefined, {
          onOutput: callbacks?.onCommandOutput,
        });
        const header = result.success
          ? `Command succeeded (exit code ${result.exitCode})`
          : `Command failed (exit code ${result.exitCode})`;
        const output = result.output
          ? `\n${result.output}`
          : "\n(no output)";
        const errMsg = result.error && !result.output.includes(result.error)
          ? `\nError: ${result.error}`
          : "";
        return `${header}${output}${errMsg}`;
      },
    },
  ];
}
