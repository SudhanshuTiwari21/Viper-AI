declare module "node-pty" {
  export interface IPty {
    readonly pid: number;
    readonly process: string;
    readonly pty: string;
    readonly cols: number;
    readonly rows: number;
    resize(cols: number, rows: number): void;
    write(data: string): void;
    kill(signal?: string): void;
    onData(cb: (data: string) => void): void;
    onExit(cb: (e: { exitCode: number; signal?: number }) => void): void;
  }

  export interface ISpawnOptions {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
  }

  export function spawn(
    file: string,
    args: string[],
    options: ISpawnOptions
  ): IPty;
}
