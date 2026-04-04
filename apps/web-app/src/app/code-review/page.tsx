'use client'

import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import { InfiniteGrid } from '@/components/ui/the-infinite-grid'
import ShimmerButton from '@/components/ui/shimmer-button'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import { useRef } from 'react'

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconShield() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  )
}

function IconCode() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function IconTerminal() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' as never })
  return { ref, isInView }
}

// ── Hero ───────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-[70vh] pt-24 pb-24 px-8 overflow-hidden flex items-center font-sans">
      <InfiniteGrid />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0) 70%)' }}
        aria-hidden="true"
      />
      <div className="max-w-6xl mx-auto w-full">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block"
        >
          Use Case / Codebase review
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-5xl md:text-6xl font-medium tracking-tight leading-none mb-8 max-w-3xl"
        >
          Review the whole<br />repository—not just the diff.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg font-light leading-relaxed max-w-xl mb-12"
        >
          Viper analyzes your entire codebase for structural health, drift between intent and reality,
          and advanced risk signals. That picture feeds product management and AI agents that write
          code—so shipping stays aligned with your roadmap and your architecture.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <ShimmerButton
            type="button"
            disabled
            aria-disabled="true"
            className="h-12 px-7 text-sm font-semibold cursor-not-allowed opacity-70 hover:scale-100"
          >
            Coming soon
          </ShimmerButton>
        </motion.div>
      </div>
    </section>
  )
}

// ── How It Works ───────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: '01',
    title: 'Scan the repo.',
    body: 'Index the full tree—modules, boundaries, and how services actually connect—so analysis is never limited to “what changed in the last PR.”',
  },
  {
    id: '02',
    title: 'Measure drift & health.',
    body: 'Run drift analysis and advanced parameters: intent vs implementation, API and contract drift, coupling, ownership blur, security posture, and release-risk signals—in one pass over the codebase.',
  },
  {
    id: '03',
    title: 'Steer PM & agents.',
    body: 'Turn findings into priorities for PM and guardrails for coding agents: what to fix first, what agents may touch, and what must stay human-reviewed before merge.',
  },
]

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-32 px-8 border-t border-border-muted font-sans">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="mb-20"
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-6 block">
            How It Works
          </span>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
            From full-repo truth to PM and agent decisions.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border-muted border border-border-muted">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.15 + i * 0.12, ease: [0.25, 0.4, 0.25, 1] }}
              className="bg-black p-10 md:p-12 flex flex-col gap-8"
            >
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-700">
                {step.id}
              </span>
              <h3 className="text-xl md:text-2xl font-medium text-white leading-snug">
                {step.title}
              </h3>
              <p className="text-neutral-500 text-sm leading-relaxed font-light flex-1">
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Feature Grid ───────────────────────────────────────────────────────────────

function ContextAware() {
  const { ref, isInView } = useFadeIn()
  return (
    <div ref={ref} className="bg-black p-12 md:p-20 flex flex-col justify-between">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
          01 / Full codebase review
        </span>
        <h2 className="text-4xl font-medium tracking-tight mb-6">
          Repository-wide, not patch-wide.
        </h2>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-md font-light">
          Every pass considers the whole codebase: entry points, shared libraries, and cross-cutting
          concerns—so you surface systemic issues and architectural pressure, not only what landed in
          the latest commit.
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
        className="mt-12 grid grid-cols-2 gap-4"
      >
        <div className="p-6 border border-border-muted hover:border-border-active transition-colors">
          <span className="text-white mb-4 block"><IconCode /></span>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-1">System graph</h4>
          <p className="text-[11px] text-neutral-500">Maps how modules and services actually depend on each other</p>
        </div>
        <div className="p-6 border border-border-muted hover:border-border-active transition-colors">
          <span className="text-white mb-4 block"><IconCheck /></span>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-1">Holistic signals</h4>
          <p className="text-[11px] text-neutral-500">Surfaces patterns no single-file linter can see</p>
        </div>
      </motion.div>
    </div>
  )
}

function SecurityAnalysis() {
  const { ref, isInView } = useFadeIn()
  return (
    <div ref={ref} className="bg-black p-12 md:p-20 flex flex-col justify-between">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
          02 / Drift & advanced parameters
        </span>
        <h2 className="text-4xl font-medium tracking-tight mb-6">
          When reality drifts from the plan.
        </h2>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-md font-light">
          Compare specs, docs, and APIs to what is really shipped. Track drift, coupling, ownership
          blur, and other advanced parameters PM and engineering leads use to prioritize work—and to
          decide where autonomous agents should or should not operate.
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
        className="mt-12 space-y-4"
      >
        {['Intent vs implementation drift', 'API & contract consistency', 'Structural risk & security posture'].map((item) => (
          <div key={item} className="flex items-center gap-4 text-sm text-neutral-400 group">
            <span className="group-hover:text-white transition-colors"><IconShield /></span>
            <span className="group-hover:text-white transition-colors">{item}</span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

const REVIEW_LINES = [
  { tag: 'SCAN   ', color: 'text-[#bd93f9]', text: 'Workspace indexed. 1,842 files. Dependency graph built.' },
  { tag: 'DRIFT  ', color: 'text-[#bd93f9]', text: 'OpenAPI v2 spec vs routes: 3 undocumented endpoints, 1 stale contract.' },
  { tag: 'DRIFT  ', color: 'text-[#ffb86c]', text: 'README architecture diagram vs modules: ownership boundary mismatch (billing ↔ notifications).' },
  { tag: 'SIGNAL ', color: 'text-[#ffb86c]', text: 'Coupling index ↑ 12% vs last baseline. Agent touch-zones flagged for review.' },
  { tag: 'PM     ', color: 'text-[#8be9fd]', text: 'Q2 initiative "Unified auth" — 2 of 5 tracked surfaces still on legacy flow.' },
  { tag: 'AGENT  ', color: 'text-[#8be9fd]', text: 'Suggested agent scope: packages/auth/* only; block auto-merge on shared/db/*.' },
  { tag: 'REPORT ', color: 'text-[#50fa7b]', text: 'Repo review complete. Priorities synced for PM board + agent guardrails. ✓' },
]

function ReviewInAction() {
  const { ref, isInView } = useFadeIn()
  return (
    <div ref={ref} className="bg-black p-12 md:p-20 md:col-span-2 border-t border-border-muted">
      <div className="grid md:grid-cols-5 gap-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
          className="md:col-span-2"
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
            03 / One picture of the repo
          </span>
          <h2 className="text-4xl font-medium tracking-tight mb-6">
            Drift, PM alignment, and agent scope—together.
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed font-light mb-10">
            The same full-repo analysis powers health dashboards for humans, backlog signals for PM,
            and boundaries for coding agents—so nobody optimizes locally while the system quietly
            diverges.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
          className="md:col-span-3 border border-border-muted bg-[#050505] p-6 font-mono text-[12px]"
        >
          <div className="flex items-center gap-2 mb-6 text-neutral-600">
            <IconTerminal />
            <span>viper.review.log</span>
          </div>
          <div className="mb-5 flex gap-3">
            <span className="text-[#6272a4]">$</span>
            <span className="text-neutral-300">
              viper codebase review{' '}
              <span className="text-[#f1fa8c]">--workspace ./acme-platform</span>
            </span>
          </div>
          <div className="space-y-3">
            {REVIEW_LINES.map(({ tag, color, text }, i) => (
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

function StandardsAndPRs() {
  const { ref, isInView } = useFadeIn()
  return (
    <div ref={ref} className="bg-black p-12 md:p-20 md:col-span-2 border-t border-border-muted">
      <div className="grid md:grid-cols-2 gap-12 items-end">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
            04 / PM + coding agents
          </span>
          <h2 className="text-5xl font-medium tracking-tight mb-6 leading-none">
            Agents write code. Viper holds the line.
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed max-w-lg font-light">
            Product management gets a live view of structural and drift debt. AI agents get clear
            scopes and policies. Full-repo review closes the loop—so generated changes do not
            silently rewrite your architecture or ignore what PM committed to customers.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
        >
          {[
            { letter: 'P', title: 'Prioritize', desc: 'PM sees drift and risk ranked against roadmap' },
            { letter: 'A', title: 'Agent scope', desc: 'Define where agents may edit and what stays human-only' },
            { letter: 'R', title: 'Review', desc: 'Full-repo checks on every agent or human change' },
            { letter: 'S', title: 'Ship', desc: 'Merge when system health and PM intent align' },
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

function FeatureGrid() {
  return (
    <section className="py-32 px-8 border-t border-border-muted font-sans">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border-muted border border-border-muted">
          <ContextAware />
          <SecurityAnalysis />
          <ReviewInAction />
          <StandardsAndPRs />
        </div>
      </div>
    </section>
  )
}

// ── CTA ────────────────────────────────────────────────────────────────────────

function CTASection() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-48 px-8 border-t border-border-muted font-sans">
      <div className="max-w-3xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-5xl md:text-6xl font-medium tracking-tight mb-8 leading-none"
        >
          One codebase. Clear drift. Safer agents.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg mb-12 font-light max-w-lg mx-auto leading-relaxed"
        >
          Full-repository review, drift analysis, and advanced health parameters—wired for PM
          planning and for AI agents that ship code. General availability is coming soon.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.25, 0.4, 0.25, 1] }}
          className="mx-auto flex max-w-xl flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center"
        >
          <ShimmerButton
            type="button"
            disabled
            aria-disabled="true"
            className="h-14 w-full shrink-0 px-6 text-sm font-bold cursor-not-allowed opacity-70 hover:scale-100 sm:w-48"
          >
            Coming soon
          </ShimmerButton>
          <Link
            href="/product-management"
            className="inline-flex h-14 w-full shrink-0 items-center justify-center rounded-md border border-slate-800 bg-transparent px-6 text-sm font-bold text-slate-300 transition-colors hover:border-slate-600 hover:text-white sm:w-48"
          >
            Product management
          </Link>
          <Link
            href="/agents"
            className="inline-flex h-14 w-full shrink-0 items-center justify-center rounded-md border border-slate-800 bg-transparent px-6 text-sm font-bold text-slate-300 transition-colors hover:border-slate-600 hover:text-white sm:w-48"
          >
            Agents
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CodeReviewPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <FeatureGrid />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
