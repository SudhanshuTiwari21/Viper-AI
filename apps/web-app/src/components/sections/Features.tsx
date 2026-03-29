'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconLayers() {
  return (
    <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  )
}

function IconGraph() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
    </svg>
  )
}

function IconDeps() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  )
}

function IconTerminal() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

// ── Shared hook ───────────────────────────────────────────────────────────────

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  return { ref, isInView }
}

// ── Sub-sections ──────────────────────────────────────────────────────────────

function UnifiedContext() {
  const { ref, isInView } = useFadeIn()
  return (
    <div ref={ref} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-12 md:p-20 flex flex-col justify-between hover:border-white/25 hover:bg-[#111111] transition-all duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
          01 / Unified Context
        </span>
        <h2 className="text-4xl font-bold tracking-tight mb-6">
          Everything in one context.
        </h2>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-md font-normal">
          Viper connects product requirements, codebase architecture, and
          development workflow into a single intelligent layer. Every part
          of the system understands what you&apos;re building — and why.
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
        className="mt-12 space-y-4"
      >
        <div className="flex items-center gap-4 text-sm text-neutral-400 group">
          <span className="group-hover:text-white transition-colors"><IconLayers /></span>
          <span className="group-hover:text-white transition-colors">Shared Context Layer</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-400 group">
          <span className="group-hover:text-white transition-colors"><IconArrow /></span>
          <span className="group-hover:text-white transition-colors">Requirements → Code Traceability</span>
        </div>
      </motion.div>
    </div>
  )
}

function CodebaseIntelligence() {
  const { ref, isInView } = useFadeIn()
  return (
    <div ref={ref} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-12 md:p-20 flex flex-col justify-between hover:border-white/25 hover:bg-[#111111] transition-all duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
          02 / Codebase Intelligence
        </span>
        <h2 className="text-4xl font-bold tracking-tight mb-6">
          AI that reads the system.
        </h2>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-md font-normal">
          Viper maps your entire codebase before making a single change.
          Dependencies traced. Architecture understood. Context never lost.
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
        className="mt-12 grid grid-cols-2 gap-4"
      >
        <div className="p-6 border border-white/10 rounded-xl hover:border-white/20 transition-colors">
          <span className="text-white mb-4 block"><IconGraph /></span>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-1">Deep Analysis</h4>
          <p className="text-[11px] text-neutral-500">Full codebase indexing</p>
        </div>
        <div className="p-6 border border-white/10 rounded-xl hover:border-white/20 transition-colors">
          <span className="text-white mb-4 block"><IconDeps /></span>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-1">Multi-file Context</h4>
          <p className="text-[11px] text-neutral-500">Dependency-aware reasoning</p>
        </div>
      </motion.div>
    </div>
  )
}

function IntentToCode() {
  const { ref, isInView } = useFadeIn()
  return (
    <div ref={ref} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-12 md:p-20 md:col-span-2 hover:border-white/25 hover:bg-[#111111] transition-all duration-300">
      <div className="grid md:grid-cols-2 gap-12 items-end">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
            03 / Intent to Code
          </span>
          <h2 className="text-5xl font-bold tracking-tight mb-6 leading-none">
            Describe it. Viper builds it.
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed max-w-lg font-normal">
            Write high-level intent. Viper understands the system, identifies
            which files need to change, plans the implementation, and executes
            it end-to-end — without losing context.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6"
        >
          {[
            { letter: 'A', title: 'Analyze', desc: 'Full system context before any change' },
            { letter: 'P', title: 'Plan', desc: 'Architecture-aware implementation path' },
            { letter: 'E', title: 'Execute', desc: 'Cross-file, end-to-end code changes' },
          ].map(({ letter, title, desc }) => (
            <div key={title} className="space-y-2">
              <div className="size-8 border border-border-muted flex items-center justify-center text-white text-sm">
                {letter}
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider">{title}</h3>
              <p className="text-[11px] text-neutral-500 leading-tight">{desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

const LOG_LINES = [
  { tag: 'ANALYZE', color: 'text-[#bd93f9]', text: 'Codebase mapped. 8 services. 247 files indexed.' },
  { tag: 'CONTEXT', color: 'text-[#bd93f9]', text: 'Requirements linked. 3 related tickets resolved.' },
  { tag: 'PLAN   ', color: 'text-[#ffb86c]', text: 'Implementation path ready. 6 files to modify.' },
  { tag: 'BUILD  ', color: 'text-[#50fa7b]', text: 'auth.service.ts → synthesized' },
  { tag: 'BUILD  ', color: 'text-[#50fa7b]', text: 'session.provider.tsx → synthesized' },
  { tag: 'REVIEW ', color: 'text-[#8be9fd]', text: 'PR #47 generated with full context diff' },
  { tag: 'SHIP   ', color: 'text-[#50fa7b]', text: 'Pipeline green. Context preserved. ✓' },
]

function DevelopmentLoop() {
  const { ref, isInView } = useFadeIn()
  return (
    <div ref={ref} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-12 md:p-20 md:col-span-2 hover:border-white/25 hover:bg-[#111111] transition-all duration-300">
      <div className="grid md:grid-cols-5 gap-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
          className="md:col-span-2"
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
            04 / The Development Loop
          </span>
          <h2 className="text-4xl font-bold tracking-tight mb-6">
            Idea to production, connected.
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed font-normal mb-10">
            The gap between product intent and shipping code is where context
            dies. Viper closes that gap — keeping every layer aligned from
            first prompt to last commit.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
          className="md:col-span-3 border border-white/10 bg-[#050505] rounded-xl p-6 font-mono text-[12px]"
        >
          <div className="flex items-center gap-2 mb-6 text-neutral-600">
            <IconTerminal />
            <span>viper.log</span>
          </div>
          <div className="mb-5 flex gap-3">
            <span className="text-[#6272a4]">$</span>
            <span className="text-neutral-300">
              viper run{' '}
              <span className="text-[#f1fa8c]">&quot;Add user authentication&quot;</span>
            </span>
          </div>
          <div className="space-y-3">
            {LOG_LINES.map(({ tag, color, text }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.35, delay: 0.4 + i * 0.1, ease: 'easeOut' }}
                className="flex items-start gap-3"
              >
                <span className={`${color} shrink-0 w-[4.5rem]`}>[{tag.trim()}]</span>
                <span className="text-neutral-400">{text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ── Section root ──────────────────────────────────────────────────────────────

export default function Features() {
  return (
    <section className="py-32 px-8 border-t border-border-muted font-sans">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UnifiedContext />
          <CodebaseIntelligence />
          <IntentToCode />
          <DevelopmentLoop />
        </div>
      </div>
    </section>
  )
}
