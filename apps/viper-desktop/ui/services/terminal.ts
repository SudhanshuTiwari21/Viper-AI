const t = () => window.viper?.terminal;

function safeCreate(root: string): Promise<{ ok: boolean }> {
  const create = t()?.create;
  return typeof create === "function" ? create(root) : Promise.resolve({ ok: false });
}

function safeWrite(data: string): Promise<void> {
  const write = t()?.write;
  return typeof write === "function" ? write(data) : Promise.resolve();
}

function safeResize(cols: number, rows: number): Promise<void> {
  const resize = t()?.resize;
  return typeof resize === "function" ? resize(cols, rows) : Promise.resolve();
}

function safeDestroy(): Promise<void> {
  const destroy = t()?.destroy;
  return typeof destroy === "function" ? destroy() : Promise.resolve();
}

function safeOnData(cb: (data: string) => void): void {
  const onData = t()?.onData;
  if (typeof onData === "function") onData(cb);
}

export const terminalApi = {
  create: safeCreate,
  write: safeWrite,
  resize: safeResize,
  destroy: safeDestroy,
  onData: safeOnData,
};
