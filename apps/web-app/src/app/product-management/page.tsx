'use client'

import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import { InfiniteGrid } from '@/components/ui/the-infinite-grid'
import ShimmerButton from '@/components/ui/shimmer-button'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconMap() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
    </svg>
  )
}

function IconLink() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  )
}

function IconSpeaker() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 1 8.835-2.535m0 0A23.74 23.74 0 0 1 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m-14.456 0a23.91 23.91 0 0 0-1.014 5.395" />
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
  const isInView = useInView(ref, { once: true, margin: '-60px' })
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
          transition={{ duration: 0.5 }}
          className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block"
        >
          Use Case / Product Management
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-5xl md:text-6xl font-medium tracking-tight leading-none mb-8 max-w-3xl"
        >
          From idea to production<br />ticket in seconds.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg font-light leading-relaxed max-w-xl mb-12"
        >
          Viper&apos;s PM layer bridges the gap between high-level product intent
          and actionable engineering work. Write once. The entire team ships
          with clarity.
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
            See the PM Workflow
          </ShimmerButton>
        </motion.div>
      </div>
    </section>
  )
}

// ── Workflow Steps ─────────────────────────────────────────────────────────────

const WORKFLOW = [
  {
    id: '01',
    title: 'Write intent.',
    body: 'Describe the feature, outcome, or change in plain language. No templates, no ticket fields, no formatting required.',
  },
  {
    id: '02',
    title: 'Viper structures it.',
    body: 'The PM Agent parses your input into a scoped requirement with acceptance criteria, edge cases, constraints, and dependencies.',
  },
  {
    id: '03',
    title: 'Engineering executes.',
    body: 'Tickets land in Jira or Linear. The Code Agent picks up the work. Every change traces back to the original intent.',
  },
]

function Workflow() {
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
            The Workflow
          </span>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
            Intent to execution.<br />Nothing lost in translation.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border-muted border border-border-muted">
          {WORKFLOW.map((step, i) => (
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

// ── Features ───────────────────────────────────────────────────────────────────

function RequirementParsing() {
  const { ref, isInView } = useFadeIn()
  return (
    <div ref={ref} className="bg-black p-12 md:p-20 flex flex-col justify-between">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
          01 / Requirement Parsing
        </span>
        <h2 className="text-4xl font-medium tracking-tight mb-6">
          Narrative in. Spec out.
        </h2>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-md font-light">
          Paste a Slack message, a product brief, or a voice note transcript.
          Viper extracts the core requirement, generates acceptance criteria, flags
          ambiguities, and identifies technical constraints.
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
        className="mt-12 space-y-4"
      >
        {['Acceptance criteria generation', 'Edge case identification', 'Constraint + dependency mapping'].map((item) => (
          <div key={item} className="flex items-center gap-4 text-sm text-neutral-400 group">
            <span className="w-1 h-1 rounded-full bg-neutral-600 shrink-0 group-hover:bg-white transition-colors" />
            <span className="group-hover:text-white transition-colors">{item}</span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

function TicketGeneration() {
  const { ref, isInView } = useFadeIn()
  return (
    <div ref={ref} className="bg-black p-12 md:p-20 flex flex-col justify-between">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
          02 / Auto Ticket Creation
        </span>
        <h2 className="text-4xl font-medium tracking-tight mb-6">
          Jira / Linear, populated.
        </h2>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-md font-light">
          Viper creates fully scoped tickets with title, description, story
          points, assignees, and linked dependencies — in Jira or Linear —
          without a single manual field.
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
        className="mt-12 grid grid-cols-2 gap-4"
      >
        <div className="p-6 border border-border-muted hover:border-border-active transition-colors">
          <span className="text-white mb-4 block"><IconMap /></span>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-1">Story Pointing</h4>
          <p className="text-[11px] text-neutral-500">AI-estimated complexity scoring</p>
        </div>
        <div className="p-6 border border-border-muted hover:border-border-active transition-colors">
          <span className="text-white mb-4 block"><IconLink /></span>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-1">Dependency Linking</h4>
          <p className="text-[11px] text-neutral-500">Blocks / blocked-by auto-detected</p>
        </div>
      </motion.div>
    </div>
  )
}

const PM_LOG_LINES = [
  { tag: 'INPUT  ', color: 'text-[#bd93f9]', text: '"Users should be able to reset their password via email."' },
  { tag: 'PARSE  ', color: 'text-[#bd93f9]', text: 'Requirement extracted. Auth + email + UX layers identified.' },
  { tag: 'SPEC   ', color: 'text-[#ffb86c]', text: 'Acceptance criteria: 4 criteria generated. 2 edge cases flagged.' },
  { tag: 'SPEC   ', color: 'text-[#ffb86c]', text: 'Constraint: token expiry, rate-limiting, secure link generation.' },
  { tag: 'TICKET ', color: 'text-[#8be9fd]', text: 'PROJ-214 created in Jira. 5 story points. Linked to PROJ-198.' },
  { tag: 'TICKET ', color: 'text-[#8be9fd]', text: 'Sub-tasks: email template, token service, reset UI, tests.' },
  { tag: 'ASSIGN ', color: 'text-[#50fa7b]', text: 'Sprint 22 backlog updated. Code Agent ready to execute. ✓' },
]

function PMInAction() {
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
            03 / Live PM Session
          </span>
          <h2 className="text-4xl font-medium tracking-tight mb-6">
            One sentence. Full sprint ticket.
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed font-light">
            Watch Viper turn a single product sentence into a fully scoped,
            dependency-linked, story-pointed ticket — ready for engineering in
            under 10 seconds.
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
            <span>viper.pm.log</span>
          </div>
          <div className="mb-5 flex gap-3">
            <span className="text-[#6272a4]">$</span>
            <span className="text-neutral-300">
              viper pm{' '}
              <span className="text-[#f1fa8c]">&quot;Users should be able to reset their password via email&quot;</span>
            </span>
          </div>
          <div className="space-y-3">
            {PM_LOG_LINES.map(({ tag, color, text }, i) => (
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

function Traceability() {
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
            04 / Traceability + Updates
          </span>
          <h2 className="text-5xl font-medium tracking-tight mb-6 leading-none">
            Every change, traced to intent.
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed max-w-lg font-light">
            Every PR links to its ticket. Every ticket links to its requirement.
            Stakeholders get automated release notes and sprint summaries —
            without chasing engineers for updates.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
          className="space-y-4"
        >
          {[
            { letter: 'T', title: 'Traceability', desc: 'Intent → ticket → PR → deploy' },
            { letter: 'N', title: 'Release Notes', desc: 'Auto-generated for every deploy' },
            { letter: 'S', title: 'Sprint Summary', desc: 'Stakeholder-ready progress reports' },
            { letter: 'C', title: 'Changelog', desc: 'Developer-focused change log per version' },
          ].map(({ letter, title, desc }) => (
            <div key={title} className="flex items-center gap-4">
              <div className="size-8 border border-border-muted flex items-center justify-center text-white text-sm shrink-0">
                {letter}
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">{title}</h3>
                <p className="text-[11px] text-neutral-500">{desc}</p>
              </div>
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
          <RequirementParsing />
          <TicketGeneration />
          <PMInAction />
          <Traceability />
        </div>
      </div>
    </section>
  )
}

// ── Integrations ───────────────────────────────────────────────────────────────

const INTEGRATIONS = [
  { name: 'Notion', desc: 'Pull product specs and feature briefs directly from your docs.' },
  { name: 'Jira', desc: 'Create, update, and link tickets across sprints and epics.' },
  { name: 'Linear', desc: 'Native linear workflow integration for high-velocity teams.' },
  { name: 'Confluence', desc: 'Sync requirements back to documentation automatically.' },
  { name: 'Slack', desc: 'Post sprint summaries and ticket updates to any channel.' },
  { name: 'GitHub', desc: 'Link every PR to its originating ticket and requirement.' },
]

function Integrations() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-32 px-8 border-t border-border-muted font-sans">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="mb-20 max-w-2xl"
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-6 block">
            Integrations
          </span>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
            Works with the tools<br />you already use.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border-muted border border-border-muted">
          {INTEGRATIONS.map((integration, i) => (
            <motion.div
              key={integration.name}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.08, ease: [0.25, 0.4, 0.25, 1] }}
              className="bg-black p-10 md:p-12 hover:bg-[#050505] transition-colors group"
            >
              <h3 className="text-lg font-medium text-white mb-3 group-hover:opacity-80 transition-opacity">
                {integration.name}
              </h3>
              <p className="text-neutral-500 text-sm leading-relaxed font-light">
                {integration.desc}
              </p>
            </motion.div>
          ))}
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
          Ship with full clarity.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg mb-12 font-light max-w-lg mx-auto leading-relaxed"
        >
          Stop losing product intent between Slack, Notion, and Jira. Viper
          keeps the full stack aligned — from first sentence to last commit.
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
            See How It Works
          </ShimmerButton>
        </motion.div>
      </div>
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProductManagementPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Workflow />
        <FeatureGrid />
        <Integrations />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
