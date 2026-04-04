'use client'

import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import { InfiniteGrid } from '@/components/ui/the-infinite-grid'
import ShimmerButton from '@/components/ui/shimmer-button'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import { useRef } from 'react'

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  return { ref, isInView }
}

function IconCheck({ className = 'size-4 text-neutral-400' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function IconX({ className = 'size-4 text-neutral-600' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

// ── Plan data (aligned with docs/VIPER_USAGE_AND_REVENUE_MODEL.md — illustrative until billing ships) ──

type PlanRow = { text: string; included: boolean }

type PlanDef = {
  id: string
  name: string
  price: string
  period: string
  blurb: string
  highlight?: boolean
  badge?: string
  rows: PlanRow[]
  cta: 'sales' | 'coming'
}

const CODING_ONLY_PLANS: PlanDef[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    period: '/ month',
    blurb: 'AI-native editing and agents in the repo—no PM tool integrations.',
    rows: [
      { text: 'Viper workspace with Ask, Plan, Debug, and Agent modes', included: true },
      { text: 'Auto and Premium model tiers with separate included usage pools', included: true },
      { text: 'Usage shown as % of included allowance per tier (monthly reset)', included: true },
      { text: 'Full-repo context for chat, edits, and codebase-style signals', included: true },
      { text: 'Optional BYOK for supported providers (your keys, your provider bill)', included: true },
      { text: 'Jira, Linear, GitHub Issues, roadmap, or ticket ↔ code in Viper', included: false },
      { text: 'Org-wide admin, SSO, or pooled seats', included: false },
    ],
    cta: 'coming',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '$40',
    period: '/ month',
    blurb: 'More included AI capacity and light team features—still coding-first.',
    highlight: true,
    badge: 'Popular',
    rows: [
      { text: 'Everything in Pro', included: true },
      { text: 'Larger included Auto and Premium pools than Pro', included: true },
      { text: 'Shared workspace and basic admin for a small team', included: true },
      { text: 'Same dual-bucket usage model (% of included per tier)', included: true },
      { text: 'Optional BYOK', included: true },
      { text: 'PM-integrated layer (requirements and tickets inside Viper)', included: false },
      { text: 'Enterprise SSO, audit exports, and procurement workflows', included: false },
    ],
    cta: 'coming',
  },
  {
    id: 'enterprise-code',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    blurb: 'Seats, security, and usage the way your platform team expects.',
    rows: [
      { text: 'Everything in Plus, negotiated per seat or pool', included: true },
      { text: 'SSO, audit-friendly controls, and admin policies', included: true },
      { text: 'Security review, annual terms, and invoice billing', included: true },
      { text: 'Onboarding and success for larger rollouts', included: true },
      { text: 'Can add PM-integrated plans (Align / Studio / Scale) under one contract', included: true },
    ],
    cta: 'sales',
  },
]

const CODE_PM_PLANS: PlanDef[] = [
  {
    id: 'align',
    name: 'Align',
    price: '$49',
    period: '/ month',
    blurb: 'One seat where coding, agents, and product context live together.',
    rows: [
      { text: 'Everything in Pro-level coding (modes, dual buckets, BYOK)', included: true },
      { text: 'PM-integrated workspace: linked issues, specs, and roadmap signals in Viper', included: true },
      { text: 'Agents and plans informed by live product context—not a separate tab', included: true },
      { text: 'Higher included Auto and Premium pools than Pro (not the same as Plus coding-only)', included: true },
      { text: 'Traceability from tickets and decisions to branches and AI runs', included: true },
      { text: 'Org-wide SSO or pooled team billing', included: false },
    ],
    cta: 'coming',
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '$89',
    period: '/ seat / month',
    blurb: 'For product and engineering teams shipping from one system.',
    highlight: true,
    badge: 'Code + PM',
    rows: [
      { text: 'Everything in Align', included: true },
      { text: 'Multi-seat workspace with admin, roles, and shared context', included: true },
      { text: 'Team-sized included usage (per-seat credits; optional pool—contracted)', included: true },
      { text: 'Deeper integrations surface (Jira / Linear / GitHub / CI signals in one pane)', included: true },
      { text: 'Priority path for roadmap on notifications and policy', included: true },
      { text: 'Dedicated security review and custom DPAs', included: false },
    ],
    cta: 'coming',
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 'Custom',
    period: '',
    blurb: 'Global contracts, compliance, and usage at enterprise scale.',
    rows: [
      { text: 'Everything in Studio, tailored to procurement and InfoSec', included: true },
      { text: 'SSO (SAML), SCIM, and audit exports', included: true },
      { text: 'Pooled or per-seat inference with negotiated caps', included: true },
      { text: 'SLAs, annual commits, and invoice workflows', included: true },
      { text: 'Solutions engineering and rollout support', included: true },
    ],
    cta: 'sales',
  },
]

// ── Hero ───────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-[48vh] pt-24 pb-12 px-8 overflow-hidden flex items-center font-sans">
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
          Pricing
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-5xl md:text-6xl font-medium tracking-tight leading-none mb-8 max-w-3xl"
        >
          Start at $20 for coding.
          <br />
          <span className="text-neutral-400">Upgrade when PM belongs in the same workspace.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg font-light leading-relaxed max-w-2xl mb-4"
        >
          We sell subscriptions: a familiar $20 individual floor (Pro), more capacity and
          light teams on Plus, then a second product line—Align, Studio, and Scale—when you want Jira,
          Linear, and roadmap context wired into the same place your agents write code.
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-500 text-sm font-light max-w-2xl"
        >
          USD, monthly list prices shown. Included model usage is metered as percentage of plan allowance
          (Auto and Premium pools)—not unlimited chat counts. Final numbers subject to finance sign-off.
        </motion.p>
      </div>
    </section>
  )
}

// ── Plan grid (reusable per section) ───────────────────────────────────────────

function PlanGrid({ plans }: { plans: PlanDef[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })

  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-border-muted border border-border-muted">
      {plans.map((plan, i) => (
        <motion.div
          key={plan.id}
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.08 + i * 0.1, ease: [0.25, 0.4, 0.25, 1] }}
          className={`relative flex flex-col bg-black p-10 md:p-12 ${plan.highlight ? 'lg:ring-1 lg:ring-inset lg:ring-white/20 lg:bg-[#050505]' : ''}`}
        >
          {plan.badge ? (
            <span className="absolute top-8 right-8 text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-500">
              {plan.badge}
            </span>
          ) : null}
          <h2 className="text-xl font-medium text-white mb-1">{plan.name}</h2>
          <p className="text-neutral-500 text-sm font-light leading-relaxed mb-6 min-h-[2.75rem]">{plan.blurb}</p>
          <div className="flex items-baseline gap-1 mb-10 flex-wrap">
            <span className="text-4xl font-medium tracking-tight text-white">{plan.price}</span>
            {plan.period ? <span className="text-neutral-500 text-sm font-light">{plan.period}</span> : null}
          </div>
          <ul className="space-y-3 flex-1 mb-10">
            {plan.rows.map((row) => (
              <li key={row.text} className="flex gap-3 text-sm leading-snug">
                <span className="shrink-0 mt-0.5">{row.included ? <IconCheck /> : <IconX />}</span>
                <span className={row.included ? 'text-neutral-400 font-light' : 'text-neutral-600 font-light'}>
                  {row.text}
                </span>
              </li>
            ))}
          </ul>
          {plan.cta === 'sales' ? (
            <Link
              href="/support"
              className="inline-flex h-12 w-full items-center justify-center rounded-md border border-white/20 bg-transparent text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
            >
              Contact sales
            </Link>
          ) : (
            <ShimmerButton
              type="button"
              disabled
              aria-disabled="true"
              className="h-12 w-full text-sm font-semibold cursor-not-allowed opacity-70 hover:scale-100"
            >
              Coming soon
            </ShimmerButton>
          )}
        </motion.div>
      ))}
    </div>
  )
}

function PlanSection({
  kicker,
  title,
  description,
  plans,
}: {
  kicker: string
  title: string
  description: string
  plans: PlanDef[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })

  return (
    <section ref={ref} className="py-20 px-8 border-t border-border-muted font-sans">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
          className="mb-12 max-w-2xl"
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-4 block">{kicker}</span>
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4 leading-tight">{title}</h2>
          <p className="text-neutral-400 text-base font-light leading-relaxed">{description}</p>
        </motion.div>
        <PlanGrid plans={plans} />
      </div>
    </section>
  )
}

// ── Usage + revenue ────────────────────────────────────────────────────────────

function UsageAndRevenue() {
  const { ref, isInView } = useFadeIn()
  return (
    <section ref={ref} className="py-24 px-8 border-t border-border-muted font-sans">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 md:gap-24 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-6 block">
            Included AI usage
          </span>
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-6 leading-tight">
            Two buckets: Auto and Premium.
          </h2>
          <p className="text-neutral-400 text-base leading-relaxed font-light mb-4">
            Auto is router-managed for everyday work. Premium is when you pin a flagship model—it draws from a
            separate monthly pool so expensive completions cannot drain your whole subscription. You see
            percentage of included allowance per bucket, not dollar burn rates.
          </p>
          <p className="text-neutral-500 text-sm leading-relaxed font-light">
            BYOK requests typically do not consume Viper-hosted pools; you pay the provider directly. We still ship
            the IDE, sync, and policy surfaces as part of your seat.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.12, ease: [0.25, 0.4, 0.25, 1] }}
          className="border border-border-muted bg-[#050505] p-8 md:p-10"
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-6 block">
            How we earn revenue
          </span>
          <ul className="space-y-5 text-sm text-neutral-400 font-light leading-relaxed">
            <li>
              <span className="text-white font-medium block mb-1">Recurring seats</span>
              Pro and Align anchor individuals; Plus and Studio expand ARPU when teams need more inference budget
              or the PM-integrated workspace.
            </li>
            <li>
              <span className="text-white font-medium block mb-1">Protected margins</span>
              Credit-based caps per Auto and Premium bucket prevent a few ultra-heavy model sessions from blowing
              unit economics—upgrade paths instead of surprise overages on list tiers.
            </li>
            <li>
              <span className="text-white font-medium block mb-1">Enterprise expansion</span>
              Enterprise (coding) and Scale (code + PM) capture SSO, audit, procurement, and negotiated pools—where
              contracts and multi-year commits live.
            </li>
          </ul>
        </motion.div>
      </div>
    </section>
  )
}

// ── Quick reference table ──────────────────────────────────────────────────────

function QuickReference() {
  const { ref, isInView } = useFadeIn()
  return (
    <section ref={ref} className="py-16 px-8 border-t border-border-muted font-sans">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
          className="border border-border-muted bg-[#050505] p-8 md:p-10 overflow-x-auto"
        >
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-6">At a glance</h3>
          <table className="w-full text-sm text-left font-light text-neutral-400 min-w-[520px]">
            <thead>
              <tr className="border-b border-border-muted text-neutral-500 text-[11px] uppercase tracking-wider">
                <th className="pb-4 pr-6 font-medium">Line</th>
                <th className="pb-4 pr-6 font-medium">Plans</th>
                <th className="pb-4 font-medium">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              <tr>
                <td className="py-4 pr-6 text-white font-medium">Coding only</td>
                <td className="py-4 pr-6">Pro · Plus · Enterprise</td>
                <td className="py-4">$20 / seat / mo → custom</td>
              </tr>
              <tr>
                <td className="py-4 pr-6 text-white font-medium">Coding + PM</td>
                <td className="py-4 pr-6">Align · Studio · Scale</td>
                <td className="py-4">$49 / seat / mo → custom</td>
              </tr>
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  )
}

// ── CTA ────────────────────────────────────────────────────────────────────────

function CTASection() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-28 px-8 border-t border-border-muted font-sans">
      <div className="max-w-2xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-3xl md:text-4xl font-medium tracking-tight mb-6"
        >
          Checkout opens when billing launches.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-500 text-base font-light mb-10 leading-relaxed"
        >
          See{' '}
          <Link href="/product-management" className="text-neutral-300 underline underline-offset-4 hover:text-white">
            product management
          </Link>{' '}
          and{' '}
          <Link href="/agents" className="text-neutral-300 underline underline-offset-4 hover:text-white">
            agents
          </Link>
          , or{' '}
          <Link href="/support" className="text-neutral-300 underline underline-offset-4 hover:text-white">
            contact us
          </Link>
          .
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <Link
            href="/support"
            className="inline-flex h-12 items-center justify-center rounded-md border border-white/20 px-8 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Talk to us
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <PlanSection
          kicker="Coding only"
          title="Pro, Plus, and Enterprise"
          description="For builders who want professional AI-assisted editing and agents inside the repo—without wiring Jira, Linear, or roadmap into Viper. Same dual-bucket usage model on every paid tier."
          plans={CODING_ONLY_PLANS}
        />
        <PlanSection
          kicker="Coding + product management"
          title="Align, Studio, and Scale"
          description="Our unified workspace: tickets, specs, and roadmap signals next to the same chat and agents that implement work—so PM and engineering stop living in different tools."
          plans={CODE_PM_PLANS}
        />
        <QuickReference />
        <UsageAndRevenue />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
