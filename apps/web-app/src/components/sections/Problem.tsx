'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const PROBLEMS = [
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
    body: 'Current AI tools see a file — not a system. They have no understanding of your architecture, your intent, or your workflow.',
  },
]

export default function Problem() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-32 px-8">
      <div className="max-w-6xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="mb-20"
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-6 block">
            The Problem
          </span>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.05] text-white">
            The way software gets built<br className="hidden md:block" /> is still broken.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PROBLEMS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.15 + i * 0.12, ease: [0.25, 0.4, 0.25, 1] }}
              className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-10 md:p-12 flex flex-col gap-8 hover:border-white/25 hover:bg-[#111111] transition-all duration-300"
            >
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-700">
                {p.id}
              </span>
              <h3 className="text-xl md:text-2xl font-medium text-white leading-snug">
                {p.title}
              </h3>
              <p className="text-neutral-500 text-sm leading-relaxed font-light flex-1">
                {p.body}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
