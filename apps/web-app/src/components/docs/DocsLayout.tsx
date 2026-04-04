'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { NAV_CONFIG } from '@/lib/nav-config'

interface NavItem {
  label: string
  slug: string[]
}

interface DocsLayoutProps {
  children: React.ReactNode
  currentSlug: string[]
  prevItem: NavItem | null
  nextItem: NavItem | null
}

const GROUP_ICONS: Record<string, React.ReactNode> = {
  'Using Viper': (
    <svg className="size-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.275 2.903 2.875 2.903.825 0 1.575-.32 2.125-.85l.375-.35.375.35c.55.53 1.3.85 2.125.85 1.6 0 2.875-1.303 2.875-2.903V6a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6v7.51Z" />
    </svg>
  ),
  Developers: (
    <svg className="size-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5 3.75 12l3 4.5m10.5-9 3 3-3 3m-4.5-9v12" />
    </svg>
  ),
}

// ── Left Sidebar ──────────────────────────────────────────────────────────────

function LeftSidebar({ currentSlug }: { currentSlug: string[] }) {
  const currentPath = currentSlug.join('/')

  return (
    <aside className="fixed left-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] hidden h-[calc(100vh-3.5rem-env(safe-area-inset-top,0px))] w-60 overflow-y-auto border-r border-white/8 px-4 py-8 lg:block">
      {NAV_CONFIG.map((group) => (
        <div key={group.group} className="mb-7">
          <div className="flex items-center gap-1.5 px-3 mb-2">
            {GROUP_ICONS[group.group]}
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.18em]">
              {group.group}
            </span>
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = item.slug.join('/') === currentPath
              return (
                <li key={item.slug.join('/')} className="relative">
                  <Link
                    href={`/docs/${item.slug.join('/')}`}
                    className="relative flex items-center w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors duration-150 group"
                  >
                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active-bar"
                          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-white rounded-full"
                          initial={{ opacity: 0, scaleY: 0.3 }}
                          animate={{ opacity: 1, scaleY: 1 }}
                          exit={{ opacity: 0, scaleY: 0.3 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}
                    </AnimatePresence>
                    <span
                      className={`relative z-10 transition-colors duration-150 ${
                        isActive
                          ? 'text-white font-medium'
                          : 'text-neutral-500 group-hover:text-neutral-200'
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </aside>
  )
}

// ── Right Sidebar (On this page) ──────────────────────────────────────────────

function RightSidebar() {
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([])
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    const contentEl = document.querySelector('.prose-doc')
    if (!contentEl) return
    const els = contentEl.querySelectorAll('h2, h3')
    const found: { id: string; text: string; level: number }[] = []
    els.forEach((el) => {
      if (el.id) {
        found.push({
          id: el.id,
          text: el.textContent?.replace(/^#\s*/, '').trim() ?? '',
          level: el.tagName === 'H2' ? 2 : 3,
        })
      }
    })
    setHeadings(found)
    if (found.length > 0) setActiveId(found[0].id)
  }, [])

  useEffect(() => {
    if (headings.length === 0) return
    const handleScroll = () => {
      const isAtBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100
      if (isAtBottom) {
        setActiveId(headings[headings.length - 1]?.id ?? '')
        return
      }
      let current = headings[0]?.id ?? ''
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= 120) current = h.id
      }
      setActiveId(current)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [headings])

  if (headings.length === 0) return null

  return (
    <aside className="fixed right-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] hidden h-[calc(100vh-3.5rem-env(safe-area-inset-top,0px))] w-64 overflow-y-auto px-6 py-9 xl:block">
      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.18em] mb-4 flex items-center gap-2">
        <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
        On this page
      </p>
      <div className="relative">
        {/* Continuous dim vertical line */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10" />
        <ul className="space-y-0.5">
          {headings.map((h) => {
            const isActive = activeId === h.id
            return (
              <li key={h.id} className="relative">
                {isActive && (
                  <motion.div
                    layoutId="toc-active-line"
                    className="absolute left-0 top-0 bottom-0 w-px bg-white"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <a
                  href={`#${h.id}`}
                  className={`flex items-start py-1.5 transition-colors duration-200 group ${
                    h.level === 3 ? 'pl-7' : 'pl-4'
                  }`}
                >
                  <span
                    className={`text-[13px] leading-snug transition-colors duration-200 ${
                      isActive
                        ? 'text-white font-semibold'
                        : 'text-neutral-500 group-hover:text-neutral-300'
                    }`}
                  >
                    {h.text}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function DocsLayout({ children, currentSlug, prevItem, nextItem }: DocsLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#09090b]">
      <div className="flex flex-1 pt-2 min-h-screen">
        <LeftSidebar currentSlug={currentSlug} />

        <main className="flex-1 lg:ml-60 xl:mr-64 px-8 lg:px-12 pt-4 pb-12 min-h-screen">
          <div className="w-full">
            {children}

            {/* Bottom Prev / Next */}
            {(prevItem || nextItem) && (
              <div className="border-t border-white/8 pt-8 mt-12 flex items-center justify-between">
                {prevItem ? (
                  <Link
                    href={`/docs/${prevItem.slug.join('/')}`}
                    className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors duration-150 group"
                  >
                    <svg className="size-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    {prevItem.label}
                  </Link>
                ) : <div />}
                {nextItem ? (
                  <Link
                    href={`/docs/${nextItem.slug.join('/')}`}
                    className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors duration-150 group"
                  >
                    {nextItem.label}
                    <svg className="size-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                ) : <div />}
              </div>
            )}
          </div>
        </main>

        <RightSidebar />
      </div>
    </div>
  )
}
