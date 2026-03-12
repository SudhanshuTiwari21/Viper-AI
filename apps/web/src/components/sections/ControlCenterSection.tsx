"use client";

import { motion } from "framer-motion";
import { GlowCard } from "@/components/ui/GlowCard";

const PANELS = [
  { title: "Agent Activity", subtitle: "Live agent status and tasks" },
  { title: "Repository Graph", subtitle: "Codebase structure" },
  { title: "Task Pipeline", subtitle: "Breakdown and progress" },
  { title: "Code Editor", subtitle: "AI-assisted editing" },
  { title: "Agent Decisions", subtitle: "Reasoning and actions" },
];

const ACTIVITY_ITEMS = [
  { label: "Codebase Analysis Running", status: "active", icon: "◇" },
  { label: "PR Created", status: "done", icon: "✓" },
  { label: "Tests Passed", status: "done", icon: "✓" },
  { label: "Review Agent Approved", status: "done", icon: "✓" },
];

export function ControlCenterSection() {
  return (
    <section
      id="control-center"
      className="relative border-t border-white/5 bg-[#030304] py-24"
    >
      <div className="noise-overlay absolute inset-0" />
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <motion.h2
          className="text-center text-3xl font-semibold text-zinc-100 md:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Control Center Preview
        </motion.h2>
        <motion.p
          className="mx-auto mt-4 max-w-2xl text-center text-zinc-400"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          Your AI engineering operating system.
        </motion.p>

        <motion.div
          className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          {PANELS.map((panel, i) => (
            <GlowCard
              key={panel.title}
              glow={i % 2 === 0 ? "blue" : "violet"}
              className="p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,212,255,0.6)]" />
                <h3 className="font-medium text-zinc-200">{panel.title}</h3>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{panel.subtitle}</p>
              {panel.title === "Agent Activity" ? (
                <div className="mt-3 space-y-2">
                  {ACTIVITY_ITEMS.map((item, j) => (
                    <motion.div
                      key={item.label}
                      className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 font-mono text-xs"
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + j * 0.08 }}
                    >
                      <span
                        className={
                          item.status === "active"
                            ? "text-cyan-400"
                            : "text-emerald-500/80"
                        }
                      >
                        {item.icon}
                      </span>
                      <span className="text-zinc-400">{item.label}</span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div
                  className="mt-3 h-16 rounded bg-white/5 font-mono text-xs text-zinc-600"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                >
                  <span className="block p-2">[ panel ]</span>
                </motion.div>
              )}
            </GlowCard>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
