import { describe, it, expect } from "vitest";
import { routeTools } from "./route-tools.js";

function intent(t: string) {
  return { intentType: t };
}
function entities(values: string[]) {
  return { entities: values.map((v) => ({ value: v })) };
}
function tasks(types: string[]) {
  return { tasks: types.map((t) => ({ type: t })) };
}

describe("routeTools", () => {
  it("CODE_SEARCH: runContextEngine and runRanking true, directLLMResponse false", () => {
    const d = routeTools(
      intent("CODE_SEARCH"),
      entities([]),
      tasks([]),
    );
    expect(d.runContextEngine).toBe(true);
    expect(d.runRanking).toBe(true);
    expect(d.directLLMResponse).toBe(false);
    expect(d.runImplementationAgent).toBe(false);
  });

  it("CODE_FIX: runContextEngine true, runImplementationAgent true", () => {
    const d = routeTools(
      intent("CODE_FIX"),
      entities(["login"]),
      tasks([]),
    );
    expect(d.runContextEngine).toBe(true);
    expect(d.runRanking).toBe(true);
    expect(d.runImplementationAgent).toBe(true);
    expect(d.directLLMResponse).toBe(false);
  });

  it("REFACTOR: runImplementationAgent true", () => {
    const d = routeTools(
      intent("REFACTOR"),
      entities(["auth"]),
      tasks([]),
    );
    expect(d.runContextEngine).toBe(true);
    expect(d.runRanking).toBe(true);
    expect(d.runImplementationAgent).toBe(true);
    expect(d.directLLMResponse).toBe(false);
  });

  it("CODE_EXPLANATION with entities: run context and ranking", () => {
    const d = routeTools(
      intent("CODE_EXPLANATION"),
      entities(["loginUser"]),
      tasks([]),
    );
    expect(d.runContextEngine).toBe(true);
    expect(d.runRanking).toBe(true);
    expect(d.runImplementationAgent).toBe(false);
    expect(d.directLLMResponse).toBe(false);
  });

  it("CODE_EXPLANATION with no entities: directLLMResponse true", () => {
    const d = routeTools(
      intent("CODE_EXPLANATION"),
      entities([]),
      tasks([]),
    );
    expect(d.directLLMResponse).toBe(true);
    expect(d.runContextEngine).toBe(false);
    expect(d.runRanking).toBe(false);
  });

  it("GENERIC intent: directLLMResponse true (e.g. greeting)", () => {
    const d = routeTools(
      intent("GENERIC"),
      entities([]),
      tasks([]),
    );
    expect(d.directLLMResponse).toBe(true);
    expect(d.runContextEngine).toBe(false);
    expect(d.runRanking).toBe(false);
  });

  it("CODE_GUIDANCE: advisory / next-steps — context + direct LLM, no patch execution", () => {
    const d = routeTools(
      intent("CODE_GUIDANCE"),
      entities([]),
      tasks([]),
    );
    expect(d.directLLMResponse).toBe(true);
    expect(d.runContextEngine).toBe(true);
    expect(d.runImplementationAgent).toBe(false);
  });

  it("PROJECT_SETUP: guided answer with context retrieval + direct LLM (no implementation loop)", () => {
    const d = routeTools(
      intent("PROJECT_SETUP"),
      entities([]),
      tasks([]),
    );
    expect(d.directLLMResponse).toBe(true);
    expect(d.runContextEngine).toBe(true);
    expect(d.runRanking).toBe(true);
    expect(d.runImplementationAgent).toBe(false);
  });

  it("unknown intent: directLLMResponse true (generic question)", () => {
    const d = routeTools(
      intent("UNKNOWN"),
      entities([]),
      tasks([]),
    );
    expect(d.directLLMResponse).toBe(true);
    expect(d.runContextEngine).toBe(false);
    expect(d.runRanking).toBe(false);
  });

  it("runs in under 1ms", () => {
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      routeTools(intent("CODE_FIX"), entities(["x"]), tasks([]));
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});
