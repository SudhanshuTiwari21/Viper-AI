'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import ShimmerButton from '@/components/ui/shimmer-button'

export default function CTA() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-48 px-8 border-t border-border-muted font-sans">
      <div className="max-w-3xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-5xl md:text-6xl font-bold tracking-tight mb-8 leading-none"
        >
          Build differently.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg mb-12 max-w-lg mx-auto leading-relaxed"
        >
          Viper is in early access. Join the waitlist and help define the next
          generation of engineering tooling.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <ShimmerButton type="button" className="h-14 w-full sm:w-56 text-sm font-bold hover:border-slate-500 hover:text-white hover:scale-[1.03] transition-transform duration-200">
            Request Early Access
          </ShimmerButton>
          <ShimmerButton type="button" className="h-14 w-full sm:w-56 text-sm font-bold hover:border-slate-500 hover:text-white hover:scale-[1.03] transition-transform duration-200">
            See How It Works
          </ShimmerButton>
        </motion.div>
      </div>
    </section>
  )
}
