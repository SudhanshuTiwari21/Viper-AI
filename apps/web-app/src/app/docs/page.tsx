'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/sections/Navbar'
import Link from 'next/link'

// ── Sidebar nav data ──────────────────────────────────────────────────────────

const LEFT_NAV = [
  {
    group: 'Guide',
    icon: (
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'installation', label: 'Installation' },
      { id: 'accessibility', label: 'Accessibility' },
      { id: 'mcp', label: 'MCP' },
      { id: 'troubleshooting', label: 'Troubleshooting' },
      { id: 'changelog', label: 'Changelog' },
      { id: 'roadmap', label: 'Roadmap' },
      { id: 'distributions', label: 'Other distributions' },
    ],
  },
  {
    group: 'Menu',
    icon: (
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
    items: [
      { id: 'Agents', label: 'Agents' },
      { id: 'primitives', label: 'Primitives' },
      { id: 'icons', label: 'Icons' },
    ],
  },
]

// ── Page sections (for right sidebar + content) ───────────────────────────────

const SECTIONS = [
  { id: 'not-a-library', heading: 'Not a library — an open component distribution' },
  { id: 'whats-included', heading: "What's included" },
  { id: 'why-viper', heading: 'Why Viper AI?' },
  { id: 'getting-started', heading: 'Getting Started' },
]

// ── Left Sidebar ──────────────────────────────────────────────────────────────

function LeftSidebar({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <aside className="fixed top-16 left-0 h-[calc(100vh-4rem)] w-56 border-r border-white/8 overflow-y-auto py-8 px-4 hidden lg:block">
      {LEFT_NAV.map((group) => (
        <div key={group.group} className="mb-8">
          <div className="flex items-center gap-2 px-3 mb-3">
            <span className="text-neutral-500">{group.icon}</span>
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">
              {group.group}
            </span>
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = active === item.id
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onSelect(item.id)}
                    className="relative w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors duration-150 group"
                  >
                    {/* Active indicator bar */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          layoutId="left-active-bar"
                          className="absolute left-0 top-1 bottom-1 w-0.5 bg-white rounded-full"
                          initial={{ opacity: 0, scaleY: 0.5 }}
                          animate={{ opacity: 1, scaleY: 1 }}
                          exit={{ opacity: 0, scaleY: 0.5 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                    </AnimatePresence>
                    {/* Background highlight */}
                    {isActive && (
                      <motion.span
                        layoutId="left-active-bg"
                        className="absolute inset-0 bg-white/5 rounded-md"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span
                      className={`relative z-10 transition-colors duration-150 ${
                        isActive
                          ? 'text-white font-medium'
                          : 'text-neutral-500 group-hover:text-neutral-300'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </aside>
  )
}

// ── Right Sidebar ─────────────────────────────────────────────────────────────

function RightSidebar({ activeSection }: { activeSection: string }) {
  return (
    <aside className="fixed top-16 right-0 h-[calc(100vh-4rem)] w-56 py-8 px-6 hidden xl:block overflow-y-auto">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
        </svg>
        On this page
      </p>
      <ul className="space-y-1">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="relative block text-sm py-1 pl-3 transition-all duration-200 group"
              >
                {/* Active left indicator */}
                <motion.span
                  className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full transition-all duration-300"
                  animate={{
                    backgroundColor: isActive ? '#ffffff' : 'rgba(255,255,255,0.1)',
                    opacity: isActive ? 1 : 0.4,
                  }}
                  transition={{ duration: 0.25 }}
                />
                <motion.span
                  animate={{ color: isActive ? '#ffffff' : 'rgb(115 115 115)' }}
                  transition={{ duration: 0.25 }}
                  className="block leading-snug group-hover:text-neutral-300"
                  style={{ fontSize: '0.8rem' }}
                >
                  {section.heading}
                </motion.span>
              </a>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

// ── Main content ──────────────────────────────────────────────────────────────

function DocContent() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Title row with arrows on the right */}
      <div className="flex items-start justify-between mb-3">
        <h1 className="text-4xl font-bold tracking-tight text-white">Introduction</h1>
        <div className="flex items-center gap-2 mt-1 shrink-0">
          <button className="size-8 flex items-center justify-center border border-white/10 rounded-md text-neutral-400 hover:text-white hover:border-white/25 transition-all duration-150">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button className="size-8 flex items-center justify-center border border-white/10 rounded-md text-neutral-400 hover:text-white hover:border-white/25 transition-all duration-150">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
      <p className="text-neutral-400 text-base mb-8 leading-relaxed">
        Use Viper AI components to power your engineering workflow.
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mb-12">
        <button className="flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-400 border border-white/10 rounded-md hover:border-white/25 hover:text-white transition-all duration-150">
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
          </svg>
          Edit on GitHub
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-400 border border-white/10 rounded-md hover:border-white/25 hover:text-white transition-all duration-150">
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
          </svg>
          Copy Markdown
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-400 border border-white/10 rounded-md hover:border-white/25 hover:text-white transition-all duration-150">
          Open
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* Intro paragraph */}
      <p className="text-neutral-300 text-[15px] leading-7 mb-10">
        <strong className="text-white font-semibold">Viper AI is a distribution of engineering components</strong> built
        for autonomous software teams. Based on the shadcn registry and inspired by modern AI-native tooling,
        our goal is to help any engineering team ship production-ready software — faster, with full system context.
      </p>

      <hr className="border-white/8 mb-10" />

      {/* Section 1 */}
      <section id="not-a-library" className="mb-12 scroll-mt-24">
        <h2 className="text-2xl font-bold text-white tracking-tight mb-4">
          Not a library — an open component distribution
        </h2>
        <p className="text-neutral-400 text-[15px] leading-7 mb-4">
          Like shadcn/ui, <strong className="text-white">Viper AI is not a typical install-from-NPM library</strong>.
          It&apos;s an open collection you can copy, modify, and customize directly in your codebase.
          This &ldquo;open code&rdquo; approach gives you maximum flexibility without wrapper overhead or styling workarounds.
        </p>
        <p className="text-neutral-400 text-[15px] leading-7">
          Every component ships as plain TypeScript and Tailwind CSS. You own the code from day one.
          No hidden abstractions, no breaking upgrades, no black boxes.
        </p>
      </section>

      {/* Section 2 */}
      <section id="whats-included" className="mb-12 scroll-mt-24">
        <h2 className="text-2xl font-bold text-white tracking-tight mb-4">
          What&apos;s included
        </h2>
        <p className="text-neutral-400 text-[15px] leading-7 mb-6">
          Viper AI ships with everything you need to build a production-grade AI engineering platform:
        </p>
        <ol className="space-y-4 mb-6">
          {[
            {
              title: 'Agent Components',
              desc: 'Pre-built UI for Code, Review, PM, and Ops agents — with built-in state management and real-time streaming support.',
            },
            {
              title: 'Context Engine',
              desc: 'A shared context layer that keeps every agent, ticket, and code change in sync across your entire workflow.',
            },
            {
              title: 'CLI Integration',
              desc: 'The Viper CLI connects your terminal directly to the agent fleet — spin up agents, monitor runs, and review outputs without leaving your editor.',
            },
            {
              title: 'Developer Primitives',
              desc: 'Accessible, motion-powered UI primitives (buttons, dialogs, cards, toasts) built on Radix UI and Framer Motion.',
            },
          ].map((item, i) => (
            <li key={item.title} className="flex gap-4">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/8 text-[11px] font-bold text-neutral-400">
                {i + 1}
              </span>
              <div>
                <span className="text-white font-semibold text-[15px]">{item.title}:</span>{' '}
                <span className="text-neutral-400 text-[15px] leading-7">{item.desc}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Section 3 */}
      <section id="why-viper" className="mb-12 scroll-mt-24">
        <h2 className="text-2xl font-bold text-white tracking-tight mb-4">
          Why Viper AI?
        </h2>
        <p className="text-neutral-400 text-[15px] leading-7 mb-4">
          Current AI coding tools see a single file — not a system. They lack the architectural context,
          cross-agent coordination, and workflow integration required to ship real software autonomously.
        </p>
        <p className="text-neutral-400 text-[15px] leading-7 mb-6">
          Viper was built from first principles to solve this. Every agent shares the same context graph.
          Every action is scoped, audited, and reversible. Every output is production-ready.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: 'System-aware', desc: 'Full codebase context before any action' },
            { title: 'Agent-native', desc: 'Built for multi-agent collaboration' },
            { title: 'Open by default', desc: 'Copy, own, and extend every component' },
          ].map((card) => (
            <div
              key={card.title}
              className="bg-[#0a0a0a] border border-white/10 rounded-lg p-5 hover:border-white/25 hover:bg-[#111] transition-all duration-300"
            >
              <h4 className="text-white font-semibold text-sm mb-1">{card.title}</h4>
              <p className="text-neutral-500 text-xs leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4 */}
      <section id="getting-started" className="mb-16 scroll-mt-24">
        <h2 className="text-2xl font-bold text-white tracking-tight mb-4">
          Getting Started
        </h2>
        <p className="text-neutral-400 text-[15px] leading-7 mb-6">
          Viper AI is currently in early access. To get started, install the CLI and connect your workspace:
        </p>
        <div className="bg-[#050505] border border-white/10 rounded-lg p-5 font-mono text-[13px] mb-6">
          <div className="flex items-center gap-2 mb-4 text-neutral-600 text-[11px] uppercase tracking-widest">
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            terminal
          </div>
          <div className="space-y-2">
            <div className="flex gap-3">
              <span className="text-neutral-600">$</span>
              <span className="text-neutral-300">npm install <span className="text-[#50fa7b]">@viper-ai/cli</span> -g</span>
            </div>
            <div className="flex gap-3">
              <span className="text-neutral-600">$</span>
              <span className="text-neutral-300">viper <span className="text-[#bd93f9]">init</span></span>
            </div>
            <div className="flex gap-3">
              <span className="text-neutral-600">$</span>
              <span className="text-neutral-300">viper <span className="text-[#8be9fd]">connect</span> --workspace my-project</span>
            </div>
          </div>
        </div>
        <p className="text-neutral-400 text-[15px] leading-7">
          For detailed installation instructions, check out the{' '}
          <Link href="#" className="text-white underline underline-offset-4 hover:text-neutral-300 transition-colors">
            Installation guide
          </Link>
          . For a full breakdown of available agents, visit the{' '}
          <Link href="/agents" className="text-white underline underline-offset-4 hover:text-neutral-300 transition-colors">
            Agents page
          </Link>
          .
        </p>
      </section>

      {/* Bottom nav */}
      <div className="border-t border-white/8 pt-8 flex items-center justify-between">
        <div className="text-sm text-neutral-600">← Previous</div>
        <Link
          href="#"
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors duration-150"
        >
          Installation
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeNav, setActiveNav] = useState('introduction')
  const [activeSection, setActiveSection] = useState('not-a-library')
  const mainRef = useRef<HTMLDivElement>(null)

  // Track scroll to update right sidebar
  useEffect(() => {
    const handleScroll = () => {
      const sections = SECTIONS.map((s) => document.getElementById(s.id))
      let current = SECTIONS[0].id
      for (const section of sections) {
        if (!section) continue
        const rect = section.getBoundingClientRect()
        if (rect.top <= 120) current = section.id
      }
      setActiveSection(current)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to section when left nav is clicked
  const handleNavSelect = (id: string) => {
    setActiveNav(id)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#09090b]">
      <Navbar />

      <div className="flex flex-1 pt-16">
        {/* Left sidebar */}
        <LeftSidebar active={activeNav} onSelect={handleNavSelect} />

        {/* Main content */}
        <main
          ref={mainRef}
          className="flex-1 lg:ml-56 xl:mr-56 px-8 py-12 min-h-screen"
        >
          <DocContent />
        </main>

        {/* Right sidebar */}
        <RightSidebar activeSection={activeSection} />
      </div>
    </div>
  )
}
