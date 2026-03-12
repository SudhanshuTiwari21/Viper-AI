const CHAT_URL = "http://localhost:3000/agent/chat";
const EDIT_URL = "http://localhost:3000/editor/apply-change";

export async function* streamChat(prompt: string): AsyncGenerator<string, void, undefined> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    yield buffer;
  }
}

export async function applyEditorChange(payload: { file: string; change: string }) {
  await fetch(EDIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

