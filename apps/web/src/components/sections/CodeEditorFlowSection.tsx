"use client";

import { motion } from "framer-motion";

const STEPS = [
  { label: "Developer", icon: "◇" },
  { label: "AI Code Editor", icon: "⌘" },
  { label: "Agent Orchestrator", icon: "◆" },
  { label: "Autonomous Engineering Agents", icon: "▣" },
];

const CODE_LINES = [
  "const pipeline = await orchestrator.run(task);",
  "await codebaseAgent.analyze(repo);",
  "const plan = await techLead.plan(scope);",
  "await implAgent.execute(subtask);",
];

export function CodeEditorFlowSection() {
  return (
    <section
      id="product"
      className="relative border-t border-white/5 bg-[#030304] py-24"
    >
      <div className="noise-overlay absolute inset-0" />
      <div className="relative z-10 mx-auto max-w-5xl px-6">
        <motion.h2
          className="text-center text-3xl font-semibold text-zinc-100 md:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          AI Code Editor + Agent System
        </motion.h2>
        <motion.p
          className="mx-auto mt-4 max-w-2xl text-center text-zinc-400"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          Viper AI is both an AI coding interface and a full engineering
          organization.
        </motion.p>

        <motion.div
          className="mt-16 flex flex-col items-center gap-0 md:flex-row md:justify-between md:gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          {STEPS.map((step, i) => (
            <div key={step.label} className="flex flex-col items-center">
              <motion.div
                className="flex h-20 w-20 items-center justify-center rounded-xl border border-cyan-500/30 bg-black/60 text-2xl text-cyan-400/90 shadow-[0_0_20px_rgba(0,212,255,0.15)]"
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 0 30px rgba(0, 212, 255, 0.25)",
                }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i }}
              >
                {step.icon}
              </motion.div>
              <span className="mt-2 text-sm font-medium text-zinc-300">
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <motion.div
                  className="my-2 h-8 w-px bg-gradient-to-b from-cyan-500/50 to-transparent md:my-0 md:h-px md:w-12 md:bg-gradient-to-r md:from-cyan-500/50 md:to-transparent"
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 * i }}
                />
              )}
            </div>
          ))}
        </motion.div>

        <motion.div
          className="mt-14 rounded-xl border border-white/10 bg-zinc-900/50 p-4 md:p-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Code flowing into the system
          </p>
          <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-black/60 font-mono text-sm">
            {CODE_LINES.map((line, i) => (
              <motion.div
                key={line}
                className="flex items-center gap-3 border-b border-white/5 px-4 py-2 last:border-0"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <span className="text-cyan-500/70">{i + 1}</span>
                <span className="text-zinc-400">{line}</span>
                <motion.span
                  className="ml-auto h-2 w-2 rounded-full bg-cyan-400/60"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
