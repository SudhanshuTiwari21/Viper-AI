"use client";

import { motion } from "framer-motion";

const PIPELINE = [
  "Repository",
  "Repo Scanner",
  "AST Parsing",
  "Metadata Extraction",
  "Dependency Graph",
  "Context Builder Engine",
];

export function CodebaseIntelligenceSection() {
  return (
    <section className="relative border-t border-white/5 bg-[#030304] py-24">
      <div className="noise-overlay absolute inset-0" />
      <div className="relative z-10 mx-auto max-w-4xl px-6">
        <motion.h2
          className="text-center text-3xl font-semibold text-zinc-100 md:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Built for Real Codebases.
        </motion.h2>
        <motion.p
          className="mx-auto mt-4 max-w-2xl text-center text-zinc-400"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          Viper AI analyzes repositories structurally instead of forcing entire
          codebases into limited LLM context windows.
        </motion.p>

        <motion.div
          className="mt-16 space-y-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          {PIPELINE.map((stage, i) => (
            <motion.div
              key={stage}
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * i }}
            >
              <div
                className="h-px flex-1 bg-gradient-to-r from-cyan-500/40 via-cyan-400/60 to-violet-500/40 animate-pulse-line"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
              <div className="rounded-xl border border-violet-500/25 bg-zinc-900/60 px-5 py-3 font-medium text-zinc-200 shadow-[0_0_20px_rgba(139,92,246,0.08)]">
                {stage}
              </div>
              <div className="h-px w-8 bg-gradient-to-r from-violet-500/40 to-cyan-500/40 md:w-16" />
            </motion.div>
          ))}
        </motion.div>
        <p className="mt-8 text-center text-xs text-zinc-500">
          Data flows through each stage → context for AI agents
        </p>

      </div>
    </section>
  );
}
