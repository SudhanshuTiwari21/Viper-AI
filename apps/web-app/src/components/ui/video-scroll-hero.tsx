'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface VideoScrollHeroProps {
  videoSrc?: string
  startScale?: number
}

export function VideoScrollHero({
  videoSrc = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  startScale = 0.25,
}: VideoScrollHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()
  const [scrollScale, setScrollScale] = useState(startScale)

  useEffect(() => {
    if (shouldReduceMotion) return

    const handleScroll = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const containerHeight = containerRef.current.offsetHeight
      const windowHeight = window.innerHeight
      const scrolled = Math.max(0, -rect.top)
      const maxScroll = containerHeight - windowHeight
      const progress = Math.min(scrolled / maxScroll, 1)
      setScrollScale(startScale + progress * (1 - startScale))
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [shouldReduceMotion, startScale])

  const shouldAnimate = !shouldReduceMotion

  return (
    <div>
      {/* Video scroll section */}
      <div ref={containerRef} className="relative h-[200vh] bg-background">
        <div className="sticky top-0 w-full h-screen flex items-start justify-center pt-20 z-10">
          <div
            className="relative flex items-center justify-center will-change-transform"
            style={{
              transform: shouldAnimate ? `scale(${scrollScale})` : 'scale(1)',
              transformOrigin: 'center center',
            }}
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-[80vw] max-w-4xl h-[60vh] object-cover shadow-2xl  "
            >
              <source src={videoSrc} type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            <motion.div
              className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center rounded-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <div className="text-center text-white">
                <motion.h2
                  className="text-2xl md:text-4xl lg:text-6xl font-bold mb-4"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.8, type: 'spring', stiffness: 200, damping: 25 }}
                >
                  The way software gets built<br className="hidden md:block" /> is still broken.
                </motion.h2>
                <motion.p
                  className="text-sm md:text-lg lg:text-xl text-white/80 max-w-2xl px-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0, duration: 0.8, type: 'spring', stiffness: 200, damping: 25 }}
                >
                  Watch the clip or Scroll down to see what's broken
                </motion.p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Next Section — Problem Cards */}
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
    </div>
  )
}
