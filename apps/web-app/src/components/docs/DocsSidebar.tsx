'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_CONFIG } from '@/lib/nav-config'

const GROUP_ICONS: Record<string, React.ReactNode> = {
  Guide: (
    <svg className="size-3.5 shrink-0 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.275 2.903 2.875 2.903.825 0 1.575-.32 2.125-.85l.375-.35.375.35c.55.53 1.3.85 2.125.85 1.6 0 2.875-1.303 2.875-2.903V6a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6v7.51Z" />
    </svg>
  ),
  Menu: (
    <svg className="size-3.5 shrink-0 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
  ),
}

export default function DocsSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-[240px] border-r border-white/8 overflow-y-auto py-8 px-4 bg-[#09090b] z-40">
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
              const href = `/docs/${item.slug.join('/')}`
              const isActive = pathname === href
              return (
                <li key={href} className="relative">
                  <Link href={href} className="relative flex items-center w-full px-3 py-1.5 rounded-md text-sm transition-colors duration-150 group">
                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          layoutId="docs-sidebar-active-bar"
                          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-white rounded-full"
                          initial={{ opacity: 0, scaleY: 0.4 }}
                          animate={{ opacity: 1, scaleY: 1 }}
                          exit={{ opacity: 0, scaleY: 0.4 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}
                    </AnimatePresence>
                    <span className={`relative z-10 transition-colors duration-150 ${
                      isActive ? 'text-white font-medium' : 'text-neutral-500 group-hover:text-neutral-200'
                    }`}>
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
