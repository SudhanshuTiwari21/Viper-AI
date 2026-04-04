const t = () => window.viper?.terminal;

function safeCreate(root: string): Promise<{ ok: boolean; termId?: string; error?: string }> {
  const create = t()?.create;
  return typeof create === "function" ? create(root) : Promise.resolve({ ok: false });
}

function safeWrite(termId: string, data: string): Promise<void> {
  const write = t()?.write;
  return typeof write === "function" ? write(termId, data) : Promise.resolve();
}

function safeResize(termId: string, cols: number, rows: number): Promise<void> {
  const resize = t()?.resize;
  return typeof resize === "function" ? resize(termId, cols, rows) : Promise.resolve();
}

function safeDestroy(termId: string): Promise<void> {
  const destroy = t()?.destroy;
  return typeof destroy === "function" ? destroy(termId) : Promise.resolve();
}

function safeDestroyAll(): Promise<void> {
  const destroyAll = t()?.destroyAll;
  return typeof destroyAll === "function" ? destroyAll() : Promise.resolve();
}

function safeOnData(cb: (termId: string, data: string) => void): (() => void) | void {
  const onData = t()?.onData;
  if (typeof onData === "function") return onData(cb);
}

function safeOnExit(cb: (termId: string) => void): (() => void) | void {
  const onExit = t()?.onExit;
  if (typeof onExit === "function") return onExit(cb);
}

export const terminalApi = {
  create: safeCreate,
  write: safeWrite,
  resize: safeResize,
  destroy: safeDestroy,
  destroyAll: safeDestroyAll,
  onData: safeOnData,
  onExit: safeOnExit,
};
