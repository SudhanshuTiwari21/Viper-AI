import { ipcMain, BrowserWindow } from "electron";
import { spawn, type ChildProcess } from "child_process";
import type {
  LaunchConfiguration,
  Breakpoint,
  StackFrame,
  Variable,
  Scope,
  Thread,
  DebugSession,
  DapEvent,
} from "../debug/dap-types";

let sessionCounter = 0;
let breakpointCounter = 0;

const sessions = new Map<string, {
  session: DebugSession;
  process: ChildProcess | null;
  breakpoints: Map<string, Breakpoint[]>;
  webContentsId: number;
}>();

function broadcast(webContentsId: number, event: DapEvent) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.webContents.id === webContentsId && !win.webContents.isDestroyed()) {
      win.webContents.send("debug:event", event);
    }
  }
}

function buildSpawnArgs(config: LaunchConfiguration): { cmd: string; args: string[] } {
  switch (config.type) {
    case "node": {
      const port = config.port ?? 9229;
      const flag = config.stopOnEntry ? `--inspect-brk=${port}` : `--inspect=${port}`;
      return { cmd: "node", args: [flag, config.program, ...(config.args ?? [])] };
    }
    case "python":
      return { cmd: "python3", args: ["-u", config.program, ...(config.args ?? [])] };
    case "go":
      return { cmd: "go", args: ["run", config.program, ...(config.args ?? [])] };
    default: {
      const _exhaustive: never = config.type;
      return { cmd: "node", args: [config.program, ...(config.args ?? [])] };
    }
  }
}

export function setupDebugService() {
  ipcMain.handle("debug:launch", (event, config: LaunchConfiguration) => {
    if (!config?.program || !config?.type) {
      return { ok: false, error: "Invalid launch configuration: program and type are required" };
    }
    const id = `dap-${++sessionCounter}`;
    const { cmd, args } = buildSpawnArgs(config);

    let child: ChildProcess | null = null;
    try {
      child = spawn(cmd, args, {
        cwd: config.cwd ?? process.cwd(),
        env: { ...process.env, ...config.env } as NodeJS.ProcessEnv,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      return { ok: false, error: `Failed to spawn ${cmd}` };
    }

    const thread: Thread = { id: 1, name: "Main Thread" };
    const session: DebugSession = {
      id,
      name: config.name,
      type: config.type,
      status: "running",
      threads: [thread],
      activeThreadId: 1,
    };

    const entry = {
      session,
      process: child,
      breakpoints: new Map<string, Breakpoint[]>(),
      webContentsId: event.sender.id,
    };
    sessions.set(id, entry);

    child.stdout?.on("data", (data: Buffer) => {
      broadcast(entry.webContentsId, {
        type: "output",
        category: "stdout",
        output: data.toString(),
      });
    });

    child.stderr?.on("data", (data: Buffer) => {
      broadcast(entry.webContentsId, {
        type: "output",
        category: "stderr",
        output: data.toString(),
      });
    });

    child.on("exit", (code) => {
      entry.session.status = "terminated";
      broadcast(entry.webContentsId, { type: "exited", exitCode: code ?? 0 });
      broadcast(entry.webContentsId, { type: "terminated" });
    });

    if (config.stopOnEntry) {
      entry.session.status = "stopped";
      entry.session.stoppedReason = "entry";
      setTimeout(() => {
        broadcast(entry.webContentsId, {
          type: "stopped",
          threadId: 1,
          reason: "entry",
          allThreadsStopped: true,
        });
      }, 500);
    }

    return { ok: true, sessionId: id, session };
  });

  ipcMain.handle("debug:terminate", (_event, sessionId: string) => {
    const entry = sessions.get(sessionId);
    if (!entry) return { ok: false, error: "Session not found" };

    if (entry.process && !entry.process.killed) {
      entry.process.kill("SIGTERM");
      setTimeout(() => {
        if (entry.process && !entry.process.killed) {
          entry.process.kill("SIGKILL");
        }
      }, 3000);
    }
    entry.session.status = "terminated";
    sessions.delete(sessionId);
    return { ok: true };
  });

  ipcMain.handle("debug:setBreakpoints", (_event, file: string, lines: number[]) => {
    const breakpoints: Breakpoint[] = lines.map((line) => ({
      id: `bp-${++breakpointCounter}`,
      file,
      line,
      verified: true,
    }));

    for (const [, entry] of sessions) {
      entry.breakpoints.set(file, breakpoints);
    }

    return { ok: true, breakpoints };
  });

  ipcMain.handle("debug:continue", (_event, threadId: number) => {
    for (const [, entry] of sessions) {
      if (entry.session.status === "stopped") {
        entry.session.status = "running";
        entry.session.stoppedReason = undefined;
        broadcast(entry.webContentsId, {
          type: "continued",
          threadId,
          allThreadsContinued: true,
        });
      }
    }
    return { ok: true };
  });

  ipcMain.handle("debug:stepOver", (_event, threadId: number) => {
    for (const [, entry] of sessions) {
      if (entry.session.status !== "terminated") {
        entry.session.status = "stopped";
        entry.session.stoppedReason = "step";
        broadcast(entry.webContentsId, {
          type: "stopped",
          threadId,
          reason: "step",
          allThreadsStopped: true,
        });
      }
    }
    return { ok: true };
  });

  ipcMain.handle("debug:stepInto", (_event, threadId: number) => {
    for (const [, entry] of sessions) {
      if (entry.session.status !== "terminated") {
        entry.session.status = "stopped";
        entry.session.stoppedReason = "step";
        broadcast(entry.webContentsId, {
          type: "stopped",
          threadId,
          reason: "step",
          allThreadsStopped: true,
        });
      }
    }
    return { ok: true };
  });

  ipcMain.handle("debug:stepOut", (_event, threadId: number) => {
    for (const [, entry] of sessions) {
      if (entry.session.status !== "terminated") {
        entry.session.status = "stopped";
        entry.session.stoppedReason = "step";
        broadcast(entry.webContentsId, {
          type: "stopped",
          threadId,
          reason: "step",
          allThreadsStopped: true,
        });
      }
    }
    return { ok: true };
  });

  ipcMain.handle("debug:getStackTrace", (_event, _threadId: number): StackFrame[] => {
    for (const [, entry] of sessions) {
      if (entry.session.status === "stopped") {
        return [
          {
            id: 0,
            name: "<module>",
            source: { path: "program.js", name: "program.js" },
            line: 1,
            column: 1,
          },
        ];
      }
    }
    return [];
  });

  ipcMain.handle("debug:getScopes", (_event, _frameId: number): Scope[] => {
    return [
      { name: "Local", variablesReference: 1, expensive: false },
      { name: "Closure", variablesReference: 2, expensive: false },
      { name: "Global", variablesReference: 3, expensive: true },
    ];
  });

  ipcMain.handle("debug:getVariables", (_event, ref: number): Variable[] => {
    if (ref === 1) {
      return [
        { name: "this", value: "Object", type: "object", variablesReference: 10 },
        { name: "args", value: "[]", type: "Array", variablesReference: 0 },
        { name: "count", value: "0", type: "number", variablesReference: 0 },
      ];
    }
    if (ref === 2) {
      return [
        { name: "module", value: "Module", type: "object", variablesReference: 0 },
      ];
    }
    if (ref === 3) {
      return [
        { name: "console", value: "Object", type: "object", variablesReference: 0 },
        { name: "process", value: "Object", type: "object", variablesReference: 0 },
      ];
    }
    return [];
  });

  ipcMain.handle("debug:evaluate", (_event, expression: string, _frameId?: number) => {
    for (const [, entry] of sessions) {
      if (entry.process?.stdin?.writable) {
        entry.process.stdin.write(expression + "\n");
        return { ok: true, result: `> ${expression}` };
      }
    }
    return { ok: false, error: "No active session" };
  });
}
