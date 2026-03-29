'use client'

import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import { InfiniteGrid } from '@/components/ui/the-infinite-grid'
import ShimmerButton from '@/components/ui/shimmer-button'
import { motion, useInView } from 'framer-motion'
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

function IconGitPR() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0-3-3m3 3 3-3M3 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm12 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" />
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
          Use Case / Code Review
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-5xl md:text-6xl font-medium tracking-tight leading-none mb-8 max-w-3xl"
        >
          Code review that<br />reads the system.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg font-light leading-relaxed max-w-xl mb-12"
        >
          Viper understands your entire codebase before reviewing a single line.
          Every review is architecture-aware, context-rich, and built for
          production-grade teams.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <ShimmerButton className="h-12 px-7 text-sm font-semibold cursor-pointer hover:border-slate-500 hover:text-white hover:scale-[1.03] transition-transform duration-200">
            Request Early Access →
          </ShimmerButton>
          <ShimmerButton className="h-12 px-7 text-sm font-semibold cursor-pointer hover:border-slate-500 hover:text-white hover:scale-[1.03] transition-transform duration-200">
            See It In Action
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
    title: 'Parse.',
    body: 'Viper indexes the full codebase, traces the dependency graph, and loads architectural context before touching a single file.',
  },
  {
    id: '02',
    title: 'Analyze.',
    body: 'Logic correctness, security vulnerabilities, performance regressions, and team standards — checked simultaneously across every changed file.',
  },
  {
    id: '03',
    title: 'Report.',
    body: 'Structured review output with inline comments, risk scores, suggested fixes, and full diff context. Ready to merge or iterate.',
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
            Three phases. Zero blind spots.
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
          01 / Context-Aware Analysis
        </span>
        <h2 className="text-4xl font-medium tracking-tight mb-6">
          Beyond the diff.
        </h2>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-md font-light">
          Viper maps how every changed line integrates with downstream services,
          API consumers, and shared utilities. It catches breakage that line-level
          tools never see.
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
          <h4 className="text-xs font-bold uppercase tracking-widest mb-1">Cross-file Impact</h4>
          <p className="text-[11px] text-neutral-500">Traces changes through the full dependency tree</p>
        </div>
        <div className="p-6 border border-border-muted hover:border-border-active transition-colors">
          <span className="text-white mb-4 block"><IconCheck /></span>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-1">Regression Detection</h4>
          <p className="text-[11px] text-neutral-500">Identifies silent regressions before they ship</p>
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
          02 / Security by Default
        </span>
        <h2 className="text-4xl font-medium tracking-tight mb-6">
          Every PR, security-scanned.
        </h2>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-md font-light">
          Injection risks, exposed credentials, broken auth patterns, insecure
          dependencies — Viper flags them all with context-aware explanations and
          suggested remediations.
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
        className="mt-12 space-y-4"
      >
        {['OWASP Top 10 coverage', 'Secret / credential detection', 'Dependency vulnerability scan'].map((item) => (
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
  { tag: 'PARSE  ', color: 'text-[#bd93f9]', text: 'PR #84 loaded. 9 files changed. 312 lines diffed.' },
  { tag: 'CONTEXT', color: 'text-[#bd93f9]', text: 'Dependency graph mapped. 14 downstream consumers.' },
  { tag: 'ANALYZE', color: 'text-[#ffb86c]', text: 'auth.middleware.ts — session token stored in localStorage. HIGH risk.' },
  { tag: 'ANALYZE', color: 'text-[#ffb86c]', text: 'api/users.ts — SQL query built with string concat. CRITICAL.' },
  { tag: 'CHECK  ', color: 'text-[#8be9fd]', text: 'Naming conventions: 2 violations in services/payment.ts.' },
  { tag: 'CHECK  ', color: 'text-[#8be9fd]', text: 'Test coverage delta: -4.2%. Threshold breached.' },
  { tag: 'REPORT ', color: 'text-[#50fa7b]', text: 'Review complete. 2 blockers, 3 warnings, 1 suggestion. ✓' },
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
            03 / Live Review
          </span>
          <h2 className="text-4xl font-medium tracking-tight mb-6">
            A review that never misses.
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed font-light mb-10">
            Viper reviews every pull request with full system context — from
            dependency impact to security posture — before a human reads a
            single line.
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
              viper review{' '}
              <span className="text-[#f1fa8c]">--pr 84 --repo acme/api-server</span>
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
            04 / Enforcement + Generation
          </span>
          <h2 className="text-5xl font-medium tracking-tight mb-6 leading-none">
            Your standards, enforced automatically.
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed max-w-lg font-light">
            Define your architectural rules, naming conventions, and test
            requirements once. Viper enforces them on every PR — and generates
            fully-scoped pull requests for every change it makes itself.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
        >
          {[
            { letter: 'R', title: 'Rules', desc: 'Custom standards per repo or team' },
            { letter: 'E', title: 'Enforce', desc: 'Automated blocking on violations' },
            { letter: 'G', title: 'Generate', desc: 'Full PRs with context and changelog' },
            { letter: 'M', title: 'Merge', desc: 'Human-in-the-loop final approval' },
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
          Review smarter.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg mb-12 font-light max-w-lg mx-auto leading-relaxed"
        >
          Join teams using Viper to catch issues before they become incidents.
          Early access is open now.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <ShimmerButton className="h-14 w-full sm:w-56 text-sm font-bold hover:border-slate-500 hover:text-white hover:scale-[1.03] transition-transform duration-200">
            Request Early Access
          </ShimmerButton>
          <ShimmerButton className="h-14 w-full sm:w-56 text-sm font-bold hover:border-slate-500 hover:text-white hover:scale-[1.03] transition-transform duration-200">
            View Documentation
          </ShimmerButton>
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
