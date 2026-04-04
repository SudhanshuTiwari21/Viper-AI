'use client'

import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import { InfiniteGrid } from '@/components/ui/the-infinite-grid'
import ShimmerButton from '@/components/ui/shimmer-button'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconCpu() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
    </svg>
  )
}

function IconEye() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
  )
}

function IconServer() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3M12 3v9.75m0 0-3-3m3 3 3-3" />
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
          Agents
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-5xl md:text-6xl font-medium tracking-tight leading-none mb-8 max-w-3xl"
        >
          Autonomous agents.<br />Real engineering output.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg font-light leading-relaxed max-w-xl mb-12"
        >
          Viper deploys specialized agents that each own a layer of your
          engineering workflow. They collaborate, share context, and execute —
          without constant supervision.
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

// ── Agent Types ────────────────────────────────────────────────────────────────

const AGENTS = [
  {
    id: '01',
    icon: <IconCpu />,
    name: 'Code Agent',
    tagline: 'Writes. Refactors. Ships.',
    body: 'Reads the full codebase before making a single change. Executes cross-file modifications, runs tests, resolves failures, and opens PRs — end-to-end.',
    capabilities: ['Cross-file code generation', 'Test execution + auto-fix', 'Refactor with zero regressions'],
  },
  {
    id: '02',
    icon: <IconEye />,
    name: 'Review Agent',
    tagline: 'Reads PRs. Enforces standards.',
    body: 'Reviews every pull request with full architectural context. Flags security issues, logic errors, and violations before any human touches the diff.',
    capabilities: ['Security vulnerability scanning', 'Standards enforcement', 'Inline comment generation'],
  },
  {
    id: '03',
    icon: <IconClipboard />,
    name: 'PM Agent',
    tagline: 'Turns intent into tickets.',
    body: 'Parses natural language product specs into structured requirements, creates scoped engineering tickets, and links requirements directly to code.',
    capabilities: ['Requirement parsing + structuring', 'Jira / Linear ticket creation', 'Acceptance criteria generation'],
  },
  {
    id: '04',
    icon: <IconServer />,
    name: 'Ops Agent',
    tagline: 'Monitors. Diagnoses. Recovers.',
    body: 'Watches pipeline health in real time, diagnoses CI failures with full context, and manages deployments and rollbacks without manual intervention.',
    capabilities: ['CI/CD failure diagnosis', 'Automated rollback triggers', 'Pipeline health monitoring'],
  },
]

function AgentTypes() {
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
            The Agent Fleet
          </span>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
            Specialized by design.<br />Collaborative by default.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border-muted border border-border-muted">
          {AGENTS.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.1, ease: [0.25, 0.4, 0.25, 1] }}
              className="bg-black p-12 md:p-16 flex flex-col gap-6"
            >
              <div className="flex items-start justify-between">
                <span className="text-white">{agent.icon}</span>
                <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-700">{agent.id}</span>
              </div>
              <div>
                <h3 className="text-2xl font-medium text-white mb-1">{agent.name}</h3>
                <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">{agent.tagline}</p>
              </div>
              <p className="text-neutral-500 text-sm leading-relaxed font-light flex-1">
                {agent.body}
              </p>
              <ul className="space-y-2 mt-2">
                {agent.capabilities.map((cap) => (
                  <li key={cap} className="flex items-center gap-3 text-[12px] text-neutral-400">
                    <span className="w-1 h-1 rounded-full bg-neutral-600 shrink-0" />
                    {cap}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Collaboration ─────────────────────────────────────────────────────────────

const COLLAB_LINES = [
  { tag: 'PM     ', color: 'text-[#bd93f9]', text: 'Ticket #112 parsed. Feature: "Add Stripe webhook handler".' },
  { tag: 'PM     ', color: 'text-[#bd93f9]', text: 'Acceptance criteria extracted. Scoping: auth, payment, db layers.' },
  { tag: 'CODE   ', color: 'text-[#50fa7b]', text: 'Codebase indexed. Webhook handler scaffolded. 4 files modified.' },
  { tag: 'CODE   ', color: 'text-[#50fa7b]', text: 'Tests written. All 12 passing. PR #92 opened.' },
  { tag: 'REVIEW ', color: 'text-[#8be9fd]', text: 'PR #92 analyzed. 0 security issues. 1 minor style warning.' },
  { tag: 'REVIEW ', color: 'text-[#8be9fd]', text: 'Standards check passed. Approving for merge.' },
  { tag: 'OPS    ', color: 'text-[#ffb86c]', text: 'Pipeline green. Deployed to staging. Health checks passing. ✓' },
]

function AgentCollaboration() {
  const { ref, isInView } = useFadeIn()

  return (
    <section className="py-32 px-8 border-t border-border-muted font-sans">
      <div className="max-w-[1400px] mx-auto">
        <div ref={ref} className="bg-black border border-border-muted p-12 md:p-20">
          <div className="grid md:grid-cols-5 gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
              className="md:col-span-2"
            >
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
                Agent Collaboration
              </span>
              <h2 className="text-4xl font-medium tracking-tight mb-6">
                One intent. Four agents. Shipped.
              </h2>
              <p className="text-neutral-400 text-lg leading-relaxed font-light">
                Agents communicate over a shared context layer. Each agent picks
                up where the last left off — PM scopes it, Code builds it, Review
                validates it, Ops ships it.
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
                <span>agent.collab.log</span>
              </div>
              <div className="mb-5 flex gap-3">
                <span className="text-[#6272a4]">$</span>
                <span className="text-neutral-300">
                  viper run{' '}
                  <span className="text-[#f1fa8c]">&quot;Add Stripe webhook handler&quot;</span>
                  <span className="text-neutral-600"> --agents all</span>
                </span>
              </div>
              <div className="space-y-3">
                {COLLAB_LINES.map(({ tag, color, text }, i) => (
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
      </div>
    </section>
  )
}

// ── Architecture ───────────────────────────────────────────────────────────────

function Architecture() {
  const { ref, isInView } = useFadeIn()

  return (
    <section className="py-32 px-8 border-t border-border-muted font-sans">
      <div className="max-w-[1400px] mx-auto">
        <div ref={ref} className="grid md:grid-cols-2 gap-px bg-border-muted border border-border-muted">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
            className="bg-black p-12 md:p-20"
          >
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
              Architecture
            </span>
            <h2 className="text-4xl font-medium tracking-tight mb-6">
              Built for trust and control.
            </h2>
            <p className="text-neutral-400 text-lg leading-relaxed font-light mb-12">
              Every agent action is scoped, audited, and reversible. You define
              the permissions. Viper operates within them — always.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { letter: 'S', title: 'Shared Memory', desc: 'Persistent context across all agents' },
                { letter: 'P', title: 'Permission Scoping', desc: 'Fine-grained per-agent access control' },
                { letter: 'A', title: 'Audit Trail', desc: 'Full log of every agent decision' },
                { letter: 'R', title: 'Rollback', desc: 'Undo any agent action in one command' },
              ].map(({ letter, title, desc }) => (
                <div key={title} className="space-y-2">
                  <div className="size-8 border border-border-muted flex items-center justify-center text-white text-sm">
                    {letter}
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider">{title}</h3>
                  <p className="text-[11px] text-neutral-500 leading-tight">{desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
            className="bg-black p-12 md:p-20"
          >
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
              Integrations
            </span>
            <h2 className="text-4xl font-medium tracking-tight mb-6">
              Plugs into how you work.
            </h2>
            <p className="text-neutral-400 text-lg leading-relaxed font-light mb-12">
              Viper agents connect natively with the tools your team already uses.
              No workflow changes required.
            </p>
            <div className="space-y-3">
              {[
                'GitHub / GitLab — code, PRs, and reviews',
                'Jira / Linear — tickets and requirements',
                'Notion / Confluence — specs and documentation',
                'Slack — status updates and escalations',
                'CI/CD — GitHub Actions, CircleCI, Jenkins',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-neutral-400 hover:text-white transition-colors group">
                  <span className="w-1 h-1 rounded-full bg-neutral-600 shrink-0 group-hover:bg-white transition-colors" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
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
          Deploy your fleet.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg mb-12 font-light max-w-lg mx-auto leading-relaxed"
        >
          Autonomous agents for your stack are in development. Public access is
          coming soon.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <ShimmerButton
            type="button"
            disabled
            aria-disabled="true"
            className="h-14 w-full sm:w-56 text-sm font-bold cursor-not-allowed opacity-70 hover:scale-100"
          >
            Coming soon
          </ShimmerButton>
        </motion.div>
      </div>
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <AgentTypes />
        <AgentCollaboration />
        <Architecture />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
