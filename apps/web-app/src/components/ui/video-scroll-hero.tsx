'use client'

import type { ReactNode } from 'react'
import { useEffect, useState, useRef } from 'react'
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useInView,
} from 'framer-motion'
import { Pause, Play } from 'lucide-react'

/** Narrative replaces the old stock video: tool fragmentation → context loss → Viper. */

const PHASE_MS = [2400, 2600, 2200, 5200] as const
const PHASE_KEYS = ['fragment', 'switching', 'lost', 'viper'] as const
type PhaseKey = (typeof PHASE_KEYS)[number]

function PhaseLabel({ phase }: { phase: PhaseKey }) {
  const copy: Record<PhaseKey, { kicker: string; title: string; sub: string }> = {
    fragment: {
      kicker: '01 — Fragmented',
      title: 'PM tools, docs, and browser AI never share the same story.',
      sub: 'Every surface holds a different slice of truth.',
    },
    switching: {
      kicker: '02 — Switching',
      title: 'You hop Jira → Notion → Slack → another browser tab for “the smart chat.”',
      sub: 'Each jump resets what the model can see.',
    },
    lost: {
      kicker: '03 — Context drain',
      title: 'Intent and codebase context dissolve across apps.',
      sub: 'You re-paste specs. You re-explain architecture. Again.',
    },
    viper: {
      kicker: '04 — One workspace',
      title: 'Viper keeps product intent, code, and AI in one engineering OS.',
      sub: 'Ship from a single place—without losing the thread.',
    },
  }
  const c = copy[phase]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, ease: [0.25, 0.4, 0.25, 1] }}
      className="pointer-events-none text-center px-4 max-w-3xl mx-auto mt-0"
    >
      <p className="text-[9px] sm:text-[10px] font-bold tracking-[0.28em] sm:tracking-[0.35em] uppercase text-white/45 mb-1 sm:mb-1.5 md:mb-2">
        {c.kicker}
      </p>
      <h2 className="text-[0.95rem] leading-tight sm:text-lg sm:leading-snug md:text-2xl lg:text-3xl font-semibold tracking-tight text-white mb-1 sm:mb-1.5 md:mb-2">
        {c.title}
      </h2>
      <p className="text-[11px] sm:text-xs md:text-[0.9375rem] text-white/55 font-light leading-snug max-w-xl mx-auto px-0.5">
        {c.sub}
      </p>
    </motion.div>
  )
}

function WindowChrome({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md sm:rounded-lg border border-white/[0.12] bg-[#0c0c0c] shadow-[0_16px_48px_-12px_rgba(0,0,0,0.85)] sm:shadow-[0_24px_80px_-12px_rgba(0,0,0,0.85)] overflow-hidden backdrop-blur-sm">
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 border-b border-white/[0.08] bg-black/40">
        <span className="flex gap-1 sm:gap-1.5">
          <span className="size-2 sm:size-2.5 rounded-full bg-[#ff5f57]/90" />
          <span className="size-2 sm:size-2.5 rounded-full bg-[#febc2e]/90" />
          <span className="size-2 sm:size-2.5 rounded-full bg-[#28c840]/90" />
        </span>
        <div className="flex-1 mx-1 sm:mx-2 h-5 sm:h-6 min-h-0 rounded-md bg-white/[0.06] border border-white/[0.06] flex items-center px-1.5 sm:px-2">
          <span className="text-[8px] sm:text-[10px] text-white/35 font-mono truncate">—</span>
        </div>
      </div>
      <div className="p-2 sm:p-3 md:p-4">{children}</div>
    </div>
  )
}

function NarrativeStage({ phase }: { phase: PhaseKey }) {
  return (
    <div className="relative w-full max-w-4xl mx-auto h-[min(20.5rem,52svh)] min-h-[17.5rem] sm:min-h-0 sm:h-[clamp(14rem,34svh,21.25rem)] md:h-[clamp(15rem,36svh,22.5rem)] shrink-0">
      {/* Ambient */}
      <div
        className="absolute inset-0 rounded-2xl opacity-40 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(255,255,255,0.06) 0%, transparent 55%)',
        }}
      />

      <AnimatePresence mode="sync">
        {phase !== 'viper' && (
          <>
            {/* PM / backlog — wrapper = responsive slot; motion = choreography */}
            <div className="absolute left-0 top-[3%] w-[40%] z-10 md:left-[4%] md:top-[8%] md:w-[38%]">
              <motion.div
                key="pm"
                className="w-full"
                initial={false}
                animate={
                  phase === 'fragment'
                    ? { x: 0, y: 0, rotate: -2, scale: 1, opacity: 1, filter: 'blur(0px)' }
                    : phase === 'switching'
                      ? { x: 12, y: 8, rotate: 4, scale: 0.96, opacity: 0.92, filter: 'blur(0.5px)' }
                      : {
                          x: -8,
                          y: 20,
                          rotate: -5,
                          scale: 0.9,
                          opacity: 0.72,
                          filter: 'blur(2px)',
                        }
                }
                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              >
                <WindowChrome>
                  <div className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/40 mb-1 sm:mb-2">
                    Sprint board
                  </div>
                  <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
                    {['Todo', 'Doing', 'Done'].map((col) => (
                      <div key={col} className="rounded border border-white/10 bg-white/[0.03] p-1 sm:p-1.5">
                        <div className="text-[7px] sm:text-[9px] text-white/35 mb-1 sm:mb-1.5">{col}</div>
                        <div className="space-y-0.5 sm:space-y-1">
                          <div className="h-1 sm:h-1.5 rounded bg-white/15 w-4/5" />
                          <div className="h-1 sm:h-1.5 rounded bg-white/10 w-3/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </WindowChrome>
              </motion.div>
            </div>

            {/* Docs */}
            <div className="absolute right-0 top-[11%] w-[42%] z-20 md:right-[6%] md:top-[18%] md:w-[40%]">
              <motion.div
                key="docs"
                className="w-full"
                initial={false}
                animate={
                  phase === 'fragment'
                    ? { x: 0, y: 0, rotate: 1.5, scale: 1, opacity: 1, filter: 'blur(0px)' }
                    : phase === 'switching'
                      ? { x: -14, y: -6, rotate: -3, scale: 0.94, opacity: 0.88, filter: 'blur(1px)' }
                      : {
                          x: 10,
                          y: -16,
                          rotate: 4,
                          scale: 0.88,
                          opacity: 0.68,
                          filter: 'blur(2px)',
                        }
                }
                transition={{ type: 'spring', stiffness: 115, damping: 20 }}
              >
                <WindowChrome>
                  <div className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/40 mb-1 sm:mb-2">
                    Product spec
                  </div>
                  <div className="space-y-1 sm:space-y-1.5">
                    <div className="h-1.5 sm:h-2 rounded bg-white/12 w-full" />
                    <div className="h-1.5 sm:h-2 rounded bg-white/10 w-[92%]" />
                    <div className="h-1.5 sm:h-2 rounded bg-white/8 w-4/5" />
                    <div className="hidden sm:block h-2 rounded bg-white/10 w-full" />
                    <div className="hidden sm:block h-2 rounded bg-white/6 w-2/3" />
                  </div>
                </WindowChrome>
              </motion.div>
            </div>

            {/* Browser AI — centered, full-width on small screens */}
            <div className="absolute left-1/2 bottom-[2%] z-30 w-[min(100%,19rem)] -translate-x-1/2 md:left-[18%] md:bottom-[6%] md:w-[52%] md:translate-x-0">
              <motion.div
                key="browser"
                className="w-full"
                initial={false}
                animate={
                  phase === 'fragment'
                    ? { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, filter: 'blur(0px)' }
                    : phase === 'switching'
                      ? { x: -4, y: -12, rotate: -2, scale: 1.02, opacity: 1, filter: 'blur(0px)' }
                      : {
                          x: 0,
                          y: 10,
                          rotate: 0,
                          scale: 0.94,
                          opacity: 0.64,
                          filter: 'blur(2.5px)',
                        }
                }
                transition={{ type: 'spring', stiffness: 100, damping: 18 }}
              >
                <div className="rounded-md sm:rounded-lg border border-white/[0.12] bg-[#080808] shadow-2xl overflow-hidden">
                  <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 border-b border-white/[0.08] bg-black/50">
                    <span className="flex gap-1 sm:gap-1.5">
                      <span className="size-2 sm:size-2.5 rounded-full bg-[#ff5f57]/90" />
                      <span className="size-2 sm:size-2.5 rounded-full bg-[#febc2e]/90" />
                      <span className="size-2 sm:size-2.5 rounded-full bg-[#28c840]/90" />
                    </span>
                    <div className="flex-1 h-5 sm:h-6 rounded-md bg-white/[0.06] border border-white/[0.06] flex items-center px-1.5 sm:px-2 min-w-0">
                      <span className="text-[8px] sm:text-[10px] text-emerald-400/70 font-mono truncate">
                        assistant.browser / chat
                      </span>
                    </div>
                  </div>
                  <div className="p-2 sm:p-3 md:p-4 grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-5">
                    <div className="md:col-span-3 space-y-1.5 sm:space-y-2">
                      <div className="rounded-md sm:rounded-lg bg-white/[0.04] border border-white/10 p-2 sm:p-2.5 text-[9px] sm:text-[11px] text-white/50 leading-snug">
                        “Summarize our API errors from last week—I don’t have the Jira link here.”
                      </div>
                      <div className="rounded-md sm:rounded-lg bg-white/[0.06] border border-white/10 p-2 sm:p-2.5 text-[8px] sm:text-[10px] text-white/35 italic leading-snug">
                        Model sees this tab—not your board, not your repo.
                      </div>
                    </div>
                    <div className="md:col-span-2 rounded border border-dashed border-white/15 bg-black/30 p-2 flex flex-col justify-center">
                      <div className="text-[8px] sm:text-[9px] text-red-400/80 uppercase tracking-wider mb-0.5 sm:mb-1">
                        Detached
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-white/30 leading-relaxed">
                        No live link to tickets, specs, or branch context.
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Context threads (visual metaphor) */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-[5] max-md:opacity-30"
              aria-hidden
            >
              <motion.path
                d="M 22% 35% Q 50% 45% 78% 38%"
                fill="none"
                stroke="url(#ctx)"
                strokeWidth="1.2"
                strokeDasharray="4 6"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={
                  phase === 'fragment'
                    ? { pathLength: 1, opacity: 0.35 }
                    : phase === 'switching'
                      ? { pathLength: 0.4, opacity: 0.2 }
                      : { pathLength: 0, opacity: 0 }
                }
                transition={{ duration: 0.8 }}
              />
              <defs>
                <linearGradient id="ctx" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
              </defs>
            </svg>

            {/* Step 3: keep a readable focal point — windows alone were too faint on black */}
            {phase === 'lost' && (
              <motion.div
                className="absolute left-1/2 top-[38%] z-[40] w-[min(92%,20rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md sm:rounded-lg border border-white/[0.14] bg-black/75 px-3 py-2.5 sm:px-4 sm:py-3 backdrop-blur-md shadow-[0_0_40px_-8px_rgba(255,255,255,0.12)] sm:top-[42%] sm:w-[88%]"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
              >
                <p className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-amber-200/90 mb-1">
                  Signal lost
                </p>
                <p className="text-center text-xs text-white/55 leading-relaxed">
                  Board, spec, and browser each hold a fragment—nothing connects the thread.
                </p>
              </motion.div>
            )}
          </>
        )}

        {phase === 'viper' && (
          <motion.div
            key="viper-panel"
            className="absolute inset-x-[2%] inset-y-[4%] sm:inset-x-[4%] sm:inset-y-[6%] md:inset-x-[8%] md:inset-y-[8%]"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          >
            <div
              className="h-full rounded-lg md:rounded-xl border border-white/20 bg-gradient-to-b from-[#111] to-[#050505] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_80px_-24px_rgba(0,0,0,0.9),0_0_60px_-20px_rgba(255,255,255,0.06)] overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
              <div className="relative flex flex-col h-full min-h-0">
                <div className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 md:py-2 border-b border-white/10 bg-black/60 shrink-0">
                  <span className="text-[11px] md:text-xs font-semibold tracking-tight text-white">Viper</span>
                  <span className="text-[9px] text-white/35 px-1.5 py-0.5 rounded-full border border-white/10 bg-white/[0.04]">
                    Workspace
                  </span>
                  <div className="flex-1 min-w-0" />
                  <span className="text-[9px] md:text-[10px] text-emerald-400/90 font-mono whitespace-nowrap">● In sync</span>
                </div>
                <div className="flex-1 grid md:grid-cols-12 gap-0 min-h-0 overflow-hidden">
                  <div className="md:col-span-4 border-r border-white/10 p-2 md:p-2.5 bg-black/20 min-h-0 overflow-hidden">
                    <div className="text-[8px] uppercase tracking-widest text-white/35 mb-1">Context</div>
                    <div className="space-y-1">
                      <div className="h-1.5 bg-emerald-500/20 rounded w-full border border-emerald-500/20" />
                      <div className="h-1.5 bg-white/10 rounded w-5/6" />
                      <div className="h-1.5 bg-white/8 rounded w-4/6" />
                    </div>
                    <div className="mt-1.5 text-[8px] md:text-[9px] text-white/30 leading-snug line-clamp-3">
                      Backlog, specs, and repo state travel together—one thread for the model.
                    </div>
                  </div>
                  <div className="md:col-span-5 p-2 md:p-2.5 border-r border-white/10 flex flex-col min-h-0">
                    <div className="text-[8px] uppercase tracking-widest text-white/35 mb-1">Assistant</div>
                    <div className="flex-1 min-h-0 rounded-md border border-white/10 bg-white/[0.03] p-2 md:p-2.5 text-[9px] md:text-[10px] text-white/60 leading-snug overflow-hidden">
                      Planning a fix with full ticket + file context—no copy-paste across apps.
                    </div>
                  </div>
                  <div className="md:col-span-3 p-2 md:p-2.5 bg-black/30 min-h-0">
                    <div className="text-[8px] uppercase tracking-widest text-white/35 mb-1">Diff</div>
                    <div className="font-mono text-[8px] md:text-[9px] space-y-0.5 text-emerald-400/70">
                      <div>+ route.ts</div>
                      <div className="text-white/25">− pasted snippet</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function VideoScrollHero() {
  const reduceMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const inView = useInView(containerRef, { once: true, amount: 0.25 })
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const phaseIndexRef = useRef(phaseIndex)
  phaseIndexRef.current = phaseIndex

  useEffect(() => {
    if (reduceMotion || !inView) return
    if (paused) return

    let cancelled = false
    let timeouts: number[] = []

    const clear = () => {
      timeouts.forEach((id) => window.clearTimeout(id))
      timeouts = []
    }

    const armFromStart = (startIndex: number) => {
      clear()
      let accumulated = 0
      for (let i = startIndex; i < PHASE_MS.length; i++) {
        accumulated += PHASE_MS[i]
        const stepIndex = i
        const id = window.setTimeout(() => {
          if (cancelled) return
          if (stepIndex < PHASE_MS.length - 1) {
            setPhaseIndex(stepIndex + 1)
          } else {
            setPhaseIndex(0)
            armFromStart(0)
          }
        }, accumulated)
        timeouts.push(id)
      }
    }

    armFromStart(phaseIndexRef.current)

    return () => {
      cancelled = true
      clear()
    }
  }, [inView, reduceMotion, paused])

  const phase = PHASE_KEYS[Math.min(phaseIndex, PHASE_KEYS.length - 1)]!

  if (reduceMotion) {
    return (
      <div>
        <section className="relative min-h-0 flex flex-col items-center justify-center bg-black px-6 py-12 md:py-16 font-sans border-t border-white/10 max-h-[calc(100svh-3.5rem)]">
          <div className="max-w-2xl text-center">
            <p className="text-[10px] font-bold tracking-[0.35em] uppercase text-white/45 mb-4">
              One workspace
            </p>
            <h2 className="text-2xl md:text-4xl font-semibold text-white leading-tight mb-4">
              PM tools, docs, and browser AI split your context. Viper unifies them for engineering.
            </h2>
            <p className="text-white/50 text-sm leading-relaxed">
              When you prefer reduced motion, we show a static summary instead of the animated story.
            </p>
          </div>
        </section>
        <ProblemCardsSection />
      </div>
    )
  }

  return (
    <div>
      <section
        ref={containerRef}
        className="relative flex flex-col justify-center bg-black py-6 sm:py-5 md:py-6 lg:py-8 font-sans border-t border-white/10 overflow-hidden min-h-0 max-sm:max-h-none max-h-[calc(100svh-3.5rem)]"
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.35]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 75%)',
          }}
        />
        <div className="relative z-10 w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-8 flex flex-col items-stretch gap-2 sm:gap-2 md:gap-3 min-h-0">
          <AnimatePresence mode="wait">
            <PhaseLabel key={phase} phase={phase} />
          </AnimatePresence>
          <div className="mt-0 min-h-0 w-full flex justify-center">
            <NarrativeStage phase={phase} />
          </div>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3 mt-2 md:mt-2 shrink-0 pb-1 sm:pb-0.5">
            <div className="flex justify-center gap-2" aria-hidden>
              {PHASE_KEYS.map((k, i) => (
                <span
                  key={k}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    i === phaseIndex ? 'w-8 bg-white/80' : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              aria-label={paused ? 'Resume story animation' : 'Pause story animation'}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white/85 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-colors"
            >
              {paused ? (
                <>
                  <Play className="size-3.5 shrink-0 opacity-90" aria-hidden />
                  Play
                </>
              ) : (
                <>
                  <Pause className="size-3.5 shrink-0 opacity-90" aria-hidden />
                  Pause
                </>
              )}
            </button>
          </div>
        </div>
      </section>
      <ProblemCardsSection />
    </div>
  )
}

function ProblemCardsSection() {
  return (
    <motion.section
      className="relative bg-muted -mt-8 rounded-t-3xl min-h-screen font-sans"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8, type: 'spring', stiffness: 200, damping: 25 }}
    >
      <div className="max-w-6xl mx-auto px-8 py-24">
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-muted-foreground mb-4 block">
            The Problem
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.05]">
            Every team feels this.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {[
            {
              id: '01',
              title: 'Scattered tools.',
              body: 'Product lives in Notion. Tasks live in Jira. Code lives in an IDE. AI lives in a chat window. None of them share context.',
            },
            {
              id: '02',
              title: 'Context switching kills velocity.',
              body: 'Every tool requires you to re-explain the system. You spend more time managing context across tools than actually shipping product.',
            },
            {
              id: '03',
              title: 'AI without system awareness.',
              body: 'Current AI tools see a file - not a system. They have no understanding of your architecture, your intent, or your workflow.',
            },
          ].map((item, index) => (
            <motion.div
              key={item.id}
              className="bg-[#0a0a0a] border border-white/10 rounded-lg p-8 shadow-lg flex flex-col gap-0 h-full hover:border-white/25 hover:bg-[#111111] transition-all duration-300"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                delay: 0.4 + index * 0.1,
                duration: 0.8,
                type: 'spring',
                stiffness: 300,
                damping: 25,
              }}
              whileHover={{
                scale: 1.02,
                y: -4,
                transition: { type: 'spring', stiffness: 400, damping: 25 },
              }}
            >
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-muted-foreground mb-5 block">
                {item.id}
              </span>
              <h3 className="text-xl font-bold text-white leading-snug mb-6 min-h-14">
                {item.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                {item.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
