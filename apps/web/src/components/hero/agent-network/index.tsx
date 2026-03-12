"use client";

import dynamic from "next/dynamic";
import { Suspense, useState } from "react";
import { AGENTS } from "./AgentNetworkScene";

const AgentNetworkCanvas = dynamic(
  () => import("./AgentNetworkCanvas").then((m) => ({ default: m.AgentNetworkCanvas })),
  { ssr: false }
);

const AGENT_DESCRIPTIONS: Record<string, string> = {
  intent: "Captures and interprets developer intent and high-level goals.",
  codebase: "Scans and analyzes repository structure, AST, and dependencies.",
  product: "Defines product requirements and prioritizes features.",
  techlead: "Owns architecture decisions and technical direction.",
  task: "Breaks work into implementable tasks and subtasks.",
  impl: "Implements features and code changes autonomously.",
  review: "Reviews pull requests and suggests improvements.",
  test: "Runs tests and security checks.",
  release: "Tracks releases and analytics.",
};

export function AgentNetwork() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="relative h-[420px] w-full md:h-[520px]">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center bg-black/50">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
          </div>
        }
      >
        <AgentNetworkCanvas hoveredId={hoveredId} setHoveredId={setHoveredId} />
      </Suspense>

      {hoveredId && (
        <div
          className="pointer-events-none absolute bottom-4 left-1/2 w-full max-w-xs -translate-x-1/2 rounded-xl border border-cyan-500/25 bg-zinc-900/90 px-4 py-3 text-sm backdrop-blur-md"
          style={{
            boxShadow:
              "0 0 0 1px rgba(0,212,255,0.1), 0 12px 40px rgba(0,0,0,0.4), 0 0 24px rgba(0,212,255,0.15)",
          }}
        >
          <span className="font-medium text-cyan-400">
            {AGENTS.find((a) => a.id === hoveredId)?.name}
          </span>
          <p className="mt-1 text-zinc-400">
            {AGENT_DESCRIPTIONS[hoveredId]}
          </p>
        </div>
      )}
    </div>
  );
}
