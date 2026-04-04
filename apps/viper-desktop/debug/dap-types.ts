export interface LaunchConfiguration {
  name: string;
  type: "node" | "python" | "go";
  request: "launch" | "attach";
  program: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  port?: number;
  stopOnEntry?: boolean;
  console?: "internalConsole" | "integratedTerminal" | "externalTerminal";
}

export interface Breakpoint {
  id: string;
  file: string;
  line: number;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
  verified: boolean;
}

export interface StackFrame {
  id: number;
  name: string;
  source: { path: string; name: string };
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface Variable {
  name: string;
  value: string;
  type: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
}

export interface Scope {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

export interface Thread {
  id: number;
  name: string;
}

export interface DebugSession {
  id: string;
  name: string;
  type: string;
  status: "running" | "stopped" | "terminated";
  threads: Thread[];
  activeThreadId?: number;
  stoppedReason?: string;
}

export type DapEvent =
  | { type: "stopped"; threadId: number; reason: string; allThreadsStopped?: boolean }
  | { type: "continued"; threadId: number; allThreadsContinued?: boolean }
  | { type: "exited"; exitCode: number }
  | { type: "terminated"; restart?: boolean }
  | { type: "output"; category: "stdout" | "stderr" | "console"; output: string }
  | { type: "breakpointChanged"; breakpoint: Breakpoint }
  | { type: "threadChanged"; reason: "started" | "exited"; threadId: number };
