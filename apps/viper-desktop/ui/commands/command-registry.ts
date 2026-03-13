export interface CommandArgs {
  target?: { path: string; isDirectory: boolean; workspaceRoot: string; name: string };
  [key: string]: unknown;
}

export interface Command {
  id: string;
  title: string;
  category?: string;
  icon?: string;
  run: (args?: CommandArgs) => void | Promise<void>;
}

const commands = new Map<string, Command>();

export function registerCommand(cmd: Command): void {
  commands.set(cmd.id, cmd);
}

export function unregisterCommand(id: string): void {
  commands.delete(id);
}

export function getCommand(id: string): Command | undefined {
  return commands.get(id);
}

export function getAllCommands(): Command[] {
  return Array.from(commands.values());
}

export function runCommand(id: string, args?: CommandArgs): Promise<void> {
  const cmd = commands.get(id);
  if (!cmd) return Promise.reject(new Error(`Unknown command: ${id}`));
  return Promise.resolve(cmd.run(args));
}
