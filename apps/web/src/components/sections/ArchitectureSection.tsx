"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArchitecturePanel } from "@/components/architecture/ArchitecturePanel";

const LAYERS = [
  {
    id: "agent",
    label: "Agent Layer",
    description:
      "All autonomous agents (Intent, Codebase Analysis, Product, Tech Lead, Task Breakdown, Implementation, Code Review, Test & Security, Release Analytics) operate at this layer and coordinate through the Orchestrator.",
  },
  {
    id: "context",
    label: "Context Builder Engine",
    description:
      "Builds and maintains structured context from repository analysis, AST, dependency graphs, and metadata. Feeds agents with precise, relevant context instead of raw dumps.",
  },
  {
    id: "memory",
    label: "Shared Memory System",
    description:
      "Persistent storage and caching layer that all agents use. Comprises Vector DB for embeddings and semantic search, PostgreSQL for structured data, and Redis for fast cache and queues.",
  },
];

const MEMORY_ITEMS = [
  { id: "vectordb", label: "Vector DB", description: "Stores embeddings and powers semantic search across code and docs." },
  { id: "postgres", label: "PostgreSQL", description: "Structured data: tasks, runs, artifacts, and relational state." },
  { id: "redis", label: "Redis", description: "Fast cache, queues, and real-time state for agent coordination." },
];

export function ArchitectureSection() {
  const [panelContent, setPanelContent] = useState<{ title: string; description: string } | null>(null);

  const openPanel = (title: string, description: string) => {
    setPanelContent({ title, description });
  };

  const closePanel = () => {
    setPanelContent(null);
  };

  return (
    <section
      id="architecture"
      className="relative border-t border-white/5 bg-[#030304] py-24"
    >
      <div className="noise-overlay absolute inset-0" />
      <div className="relative z-10 mx-auto max-w-4xl px-6">
        <motion.h2
          className="text-center text-3xl font-semibold text-zinc-100 md:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Interactive Architecture
        </motion.h2>
        <motion.p
          className="mx-auto mt-4 max-w-2xl text-center text-zinc-400"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          Click a component to learn more.
        </motion.p>

        <motion.div
          className="mt-16 space-y-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          {LAYERS.map((layer) => (
            <motion.button
              key={layer.id}
              type="button"
              className="w-full rounded-xl border border-cyan-500/25 bg-black/50 px-6 py-4 text-left transition-all hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:shadow-[0_0_25px_rgba(0,212,255,0.1)]"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => openPanel(layer.label, layer.description)}
            >
              <span className="font-medium text-zinc-200">{layer.label}</span>
            </motion.button>
          ))}

          <div className="rounded-xl border border-violet-500/25 bg-black/50 p-4">
            <p className="mb-3 text-sm font-medium text-violet-300">
              Shared Memory System
            </p>
            <div className="flex flex-wrap gap-3">
              {MEMORY_ITEMS.map((item) => (
                <motion.button
                  key={item.id}
                  type="button"
                  className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm text-violet-200 transition-all hover:border-violet-400/50 hover:bg-violet-500/20"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openPanel(item.label, item.description)}
                >
                  {item.label}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {panelContent && (
        <ArchitecturePanel
          title={panelContent.title}
          description={panelContent.description}
          isOpen
          onClose={closePanel}
        />
      )}
    </section>
  );
}
