'use client'

import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import ShimmerButton from '@/components/ui/shimmer-button'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState } from 'react'
import Link from 'next/link'

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconDiscord() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.045.034.059a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
}

function IconGitHub() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  )
}

function IconBook() {
  return (
    <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  )
}

function IconChevron() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <section className="pt-24 pb-20 px-8 border-b border-border-muted font-sans">
      <div className="max-w-6xl mx-auto">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-6 block"
        >
          Resources / Support
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-5xl md:text-6xl font-medium tracking-tight leading-none mb-8 max-w-3xl"
        >
          How can we help?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg font-light leading-relaxed max-w-xl"
        >
          Find answers in our documentation, get help from the community on Discord,
          or reach the team directly. We&apos;re here.
        </motion.p>
      </div>
    </section>
  )
}

// ── Support Channels ───────────────────────────────────────────────────────────

const CHANNELS = [
  {
    icon: <IconDiscord />,
    title: 'Discord Community',
    desc: 'Join 1,200+ engineers building with Viper. Get help, share feedback, and stay up to date with the latest releases.',
    action: 'Join Discord',
    href: '#',
    tag: 'Fastest response',
    tagColor: 'text-[#50fa7b]',
  },
  {
    icon: <IconGitHub />,
    title: 'GitHub Issues',
    desc: 'Report bugs, request features, and track known issues. All Viper development happens in the open.',
    action: 'Open an Issue',
    href: '#',
    tag: 'Open source',
    tagColor: 'text-[#8be9fd]',
  },
  {
    icon: <IconMail />,
    title: 'Email Support',
    desc: 'For enterprise questions, security disclosures, or anything that needs a private conversation with the team.',
    action: 'Send a Message',
    href: 'mailto:support@viper.ai',
    tag: 'Enterprise + security',
    tagColor: 'text-[#ffb86c]',
  },
  {
    icon: <IconBook />,
    title: 'Documentation',
    desc: 'Full guides for installation, configuration, agent setup, integrations, and API reference.',
    action: 'Read the Docs',
    href: '#',
    tag: 'Self-serve',
    tagColor: 'text-[#bd93f9]',
  },
]

function Channels() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-20 px-8 border-b border-border-muted font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border-muted border border-border-muted">
          {CHANNELS.map((channel, i) => (
            <motion.div
              key={channel.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.1, ease: [0.25, 0.4, 0.25, 1] }}
              className="bg-black p-10 md:p-12 flex flex-col gap-6 group hover:bg-[#050505] transition-colors"
            >
              <div className="flex items-start justify-between">
                <span className="text-neutral-400 group-hover:text-white transition-colors">
                  {channel.icon}
                </span>
                <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${channel.tagColor}`}>
                  {channel.tag}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-3">{channel.title}</h3>
                <p className="text-neutral-500 text-sm leading-relaxed font-light">{channel.desc}</p>
              </div>
              <Link
                href={channel.href}
                className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mt-auto"
              >
                {channel.action} →
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── FAQ ────────────────────────────────────────────────────────────────────────

interface FAQItem {
  question: string
  answer: string
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'What is Viper AI?',
    answer:
      'Viper is an autonomous engineering operating system. It connects your product requirements, codebase, and development workflow into a single intelligent layer — then executes engineering work end-to-end, from requirement parsing to shipped pull request.',
  },
  {
    question: 'How does Viper connect to my codebase?',
    answer:
      'Viper installs as a desktop app and CLI. It indexes your local repositories using a dependency-aware AST parser, building a live understanding of your architecture. No code is stored externally without your explicit permission.',
  },
  {
    question: 'What LLMs does Viper use under the hood?',
    answer:
      'Viper is model-agnostic by design. It currently supports OpenAI GPT-4o, Anthropic Claude, and local models via Ollama. You can configure which model handles which agent role from the settings panel.',
  },
  {
    question: 'Is my code sent to the cloud?',
    answer:
      'Viper processes code locally by default. When using cloud-hosted LLMs, only the minimal context needed for the current task is sent. We never store, train on, or share your code. Enterprise plans support fully air-gapped local model deployments.',
  },
  {
    question: 'How do I get early access?',
    answer:
      'Viper is currently in private early access. You can join the waitlist at the top of this page. We onboard teams in batches and prioritize teams who provide feedback. Early access is free.',
  },
  {
    question: 'What integrations are currently supported?',
    answer:
      'Viper currently integrates with GitHub, GitLab, Jira, Linear, Notion, Cursor, and VS Code. Discord, Slack, and Confluence integrations are in active development. Check the changelog for the latest.',
  },
  {
    question: 'Can I use Viper on an existing codebase?',
    answer:
      'Yes. Viper is designed for real-world, existing codebases — not greenfield projects. Point it at any repository and it will index the architecture, map dependencies, and begin reasoning about your system within minutes.',
  },
  {
    question: 'Does Viper require a specific tech stack?',
    answer:
      'Viper currently has first-class support for TypeScript, Python, Go, and Rust. JavaScript, Java, and C++ support is in beta. The underlying context engine is language-agnostic, so more languages are being added continuously.',
  },
]

function FAQAccordion({ item, index }: { item: FAQItem; index: number }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay: (index % 4) * 0.07, ease: [0.25, 0.4, 0.25, 1] }}
      className="border-b border-border-muted last:border-b-0"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left gap-6 group"
      >
        <span className="text-base font-medium text-white group-hover:opacity-80 transition-opacity">
          {item.question}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-neutral-500 shrink-0"
        >
          <IconChevron />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-neutral-400 text-sm leading-relaxed font-light max-w-2xl">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function FAQ() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-32 px-8 border-b border-border-muted font-sans">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="mb-20"
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-6 block">
            Frequently Asked Questions
          </span>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
            Quick answers.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-24">
          <div>
            {FAQ_ITEMS.slice(0, 4).map((item, i) => (
              <FAQAccordion key={item.question} item={item} index={i} />
            ))}
          </div>
          <div>
            {FAQ_ITEMS.slice(4).map((item, i) => (
              <FAQAccordion key={item.question} item={item} index={i + 4} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Getting Started ────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: '01',
    title: 'Install Viper.',
    body: 'Download the desktop app for macOS, Windows, or Linux. Or install the CLI with a single npm install command.',
    code: 'npm install -g @viper-ai/cli',
  },
  {
    id: '02',
    title: 'Connect your repo.',
    body: 'Point Viper at any local repository. It will index the codebase, map the architecture, and load your project context.',
    code: 'viper init --repo ./my-project',
  },
  {
    id: '03',
    title: 'Run your first prompt.',
    body: 'Describe what you want to build, fix, or review. Viper will analyze, plan, and execute — showing you every step.',
    code: 'viper run "Add rate limiting to the auth API"',
  },
]

function GettingStarted() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-32 px-8 border-b border-border-muted font-sans">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="mb-20"
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-6 block">
            Getting Started
          </span>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
            Up and running<br />in three steps.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border-muted border border-border-muted">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.15 + i * 0.12, ease: [0.25, 0.4, 0.25, 1] }}
              className="bg-black p-10 md:p-12 flex flex-col gap-6"
            >
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-700">
                {step.id}
              </span>
              <h3 className="text-xl font-medium text-white">{step.title}</h3>
              <p className="text-neutral-500 text-sm leading-relaxed font-light flex-1">{step.body}</p>
              <div className="border border-border-muted bg-[#050505] p-4 font-mono text-[11px] text-[#50fa7b] overflow-x-auto">
                $ {step.code}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Status ─────────────────────────────────────────────────────────────────────

const STATUS_ITEMS = [
  { service: 'Viper Cloud', status: 'Operational', color: 'bg-[#50fa7b]' },
  { service: 'GitHub Integration', status: 'Operational', color: 'bg-[#50fa7b]' },
  { service: 'Jira / Linear Sync', status: 'Operational', color: 'bg-[#50fa7b]' },
  { service: 'Model Inference (OpenAI)', status: 'Operational', color: 'bg-[#50fa7b]' },
  { service: 'Model Inference (Anthropic)', status: 'Operational', color: 'bg-[#50fa7b]' },
  { service: 'CLI Package Registry', status: 'Operational', color: 'bg-[#50fa7b]' },
]

function SystemStatus() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-20 px-8 border-b border-border-muted font-sans">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex items-center justify-between mb-12"
        >
          <div>
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-3 block">
              System Status
            </span>
            <h2 className="text-2xl font-medium tracking-tight">
              All systems operational.
            </h2>
          </div>
          <Link
            href="#"
            className="text-[12px] text-neutral-500 hover:text-white transition-colors"
          >
            Status page →
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border-muted border border-border-muted">
          {STATUS_ITEMS.map((item, i) => (
            <motion.div
              key={item.service}
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.07, ease: [0.25, 0.4, 0.25, 1] }}
              className="bg-black p-6 flex items-center justify-between"
            >
              <span className="text-sm text-neutral-400">{item.service}</span>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                <span className="text-[11px] text-neutral-500">{item.status}</span>
              </div>
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
          Still have questions?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg mb-12 font-light max-w-lg mx-auto leading-relaxed"
        >
          The Viper team responds to every message. Reach us on Discord for the
          fastest reply, or email us for anything that needs a deeper conversation.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <ShimmerButton className="h-14 w-full sm:w-56 text-sm font-bold hover:border-slate-500 hover:text-white hover:scale-[1.03] transition-transform duration-200">
            Join Discord
          </ShimmerButton>
          <ShimmerButton className="h-14 w-full sm:w-56 text-sm font-bold hover:border-slate-500 hover:text-white hover:scale-[1.03] transition-transform duration-200">
            Email the Team
          </ShimmerButton>
        </motion.div>
      </div>
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Header />
        <Channels />
        <GettingStarted />
        <FAQ />
        <SystemStatus />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
