"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { AgentNetwork } from "./agent-network";

export function HeroSection() {
  return (
    <section id="agents" className="relative min-h-screen overflow-hidden bg-[#030304] pt-24">
      <div className="noise-overlay absolute inset-0 z-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-violet-500/5" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-12 md:pt-20">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-100 md:text-5xl lg:text-6xl">
            The First{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent glow-text-blue">
              AI Engineering Organization.
            </span>
          </h1>
          <motion.p
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Viper AI combines an intelligent AI code editor with autonomous
            engineering agents that design, build, review, and ship software.
          </motion.p>
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <Link
              href="#control-center"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-6 py-3.5 text-sm font-medium text-cyan-300 transition-all hover:border-cyan-400/70 hover:bg-cyan-500/25 hover:shadow-[0_0_30px_rgba(0,212,255,0.25)]"
            >
              Get Started
            </Link>
            <Link
              href="#architecture"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-medium text-zinc-300 transition-all hover:bg-white/10 hover:text-zinc-100"
            >
              View Architecture
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-12 md:mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-2xl shadow-cyan-500/5">
            <AgentNetwork />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
