'use client'

import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState } from 'react'
import Link from 'next/link'

const DISCORD_INVITE_URL = 'https://discord.gg/hxAvwyAVkb'

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
          Get help from the community on Discord, open an issue on GitHub, or reach
          the team by email. We&apos;re here.
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
    href: DISCORD_INVITE_URL,
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
    desc: 'Write info@viperai.tech for enterprise questions, security disclosures, or anything that needs a private conversation with the team.',
    action: 'Send a Message',
    href: 'mailto:info@viperai.tech',
    tag: 'Enterprise + security',
    tagColor: 'text-[#ffb86c]',
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
                {...(channel.href.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
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
      'Viper is a hosted workspace for serious software work: your repo, AI chat and agents (Ask, Plan, Debug, Agent), and—on higher tiers—product context from the tools your team already uses. We run sign-in, API, and model routing in Viper Cloud so you use a normal client, not a server you operate yourself.',
  },
  {
    question: 'How does Viper connect to my codebase?',
    answer:
      'You install the Viper desktop app (or use the web client when your plan includes it) and open the folder for your project. The app reads and indexes that workspace on your machine so answers are grounded in your tree. Chat and inference go through Viper Cloud; you do not run our backend locally. Exactly what context is included in each request depends on your prompts, settings, and plan.',
  },
  {
    question: 'Is my code sent to the cloud?',
    answer:
      'Your project files stay on your disk unless you choose to sync or export them elsewhere. When you use hosted models, Viper sends only the prompts and excerpts needed for that turn—similar to any cloud AI assistant. We do not use your code to train public models. Some enterprise plans support stricter data handling or bring-your-own-key setups; your contract and admin controls define the details.',
  },
  {
    question: 'Which models does Viper use?',
    answer:
      'Viper is built to work with multiple providers over time. In the product you mostly choose experience, not a raw model SKU: for example Auto (balanced routing) and Premium (stronger pinned models), with usage shown as how much of your included allowance you have used. Your organization may allow bring-your-own API keys for certain providers so billing for tokens goes to you instead of through Viper.',
  },
  {
    question: 'Can I use Viper on an existing codebase?',
    answer:
      'Yes. Viper is meant for real codebases you already have—not demo toys. Open the repo root (or the package you care about), let the workspace index, then ask questions or run agents against that context. Large monorepos may take a bit longer to feel “warm” the first time.',
  },
  {
    question: 'Does Viper require a specific tech stack?',
    answer:
      'No single stack is required. Understanding is best today for common backend and frontend languages—TypeScript, JavaScript, Python, Go, and Rust are strong; Java, C++, and others improve over time. If your language is niche, you still get value from file-aware chat; deep structural features vary by language maturity.',
  },
  {
    question: 'What does Viper integrate with?',
    answer:
      'The roadmap centers on tools teams already pay for: Git hosts (e.g. GitHub, GitLab), issue trackers and roadmaps (e.g. Jira, Linear), docs (e.g. Notion), and notifications (e.g. Slack, Discord). Not every connector ships on day one—availability depends on your plan and what we have enabled for your workspace. Ask info@viperai.tech if you need a specific system for a pilot.',
  },
  {
    question: 'How do I get access?',
    answer:
      'We are rolling out invites and installs in phases. This site does not offer a self-serve download yet. Watch for announcements, or email info@viperai.tech with your team size and use case if you want to talk about timing and plans.',
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
            Frequently asked questions
          </span>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
            Straight answers.
          </h2>
          <p className="text-neutral-500 text-sm font-light leading-relaxed max-w-2xl mt-6">
            Hosted product, real repos, honest limits. If something below doesn’t match what your admin told you,
            their policy wins.
          </p>
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

const STEPS: {
  id: string
  title: string
  body: string
  hint: string
}[] = [
  {
    id: '01',
    title: 'Create your account.',
    body: 'Viper is hosted for you: sign-in, API, and model routing run in Viper Cloud. You only need a normal account—no servers or API keys on your side for everyday use.',
    hint: 'Sign up → verify email if prompted → stay signed in across desktop and web.',
  },
  {
    id: '02',
    title: 'Install the app.',
    body: 'Download the Viper desktop app (or use the web client when available) from your onboarding link or your team’s IT portal. The app connects to our hosted service automatically.',
    hint: 'Installers roll out with general availability.\nUntil then, your invite or admin shares how to get the build.',
  },
  {
    id: '03',
    title: 'Open a workspace and chat.',
    body: 'Open the folder for the project you’re working on. Chat runs against your workspace with Ask, Plan, Debug, or Agent; pick Auto or Premium when you need a stronger model. Replies stream from Viper Cloud like any hosted product.',
    hint: 'File → Open folder…\nThen open Chat and choose your mode.',
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
          <p className="text-neutral-500 text-sm font-light leading-relaxed max-w-2xl mt-6">
            Viper hosts sign-in, API, and models in the cloud. These steps are all you need in the client.
          </p>
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
              <div className="border border-border-muted bg-[#050505] p-4 font-mono text-[11px] text-[#8be9fd] whitespace-pre-line leading-relaxed">
                {step.hint}
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
          fastest reply, or write to{' '}
          <a href="mailto:info@viperai.tech" className="text-neutral-200 underline underline-offset-4 hover:text-white">
            info@viperai.tech
          </a>{' '}
          for anything that needs a deeper conversation.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-14 w-full sm:w-56 animate-[shimmer2_2s_infinite_linear] items-center justify-center rounded-md border border-slate-800 bg-[linear-gradient(110deg,#000103,45%,#1e2631,55%,#000103)] [background-size:200%_100%] px-6 text-sm font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white hover:scale-[1.03] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Join Discord
          </Link>
          <Link
            href="mailto:info@viperai.tech"
            className="inline-flex h-14 w-full sm:w-56 items-center justify-center rounded-md border border-slate-800 bg-transparent text-sm font-bold text-slate-300 transition-colors hover:border-slate-600 hover:text-white hover:scale-[1.03] duration-200"
          >
            Email the team
          </Link>
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
