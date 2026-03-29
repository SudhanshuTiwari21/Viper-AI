'use client'
import React from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Logo } from '@/components/ui/Logo'
import { Button, buttonVariants } from '@/components/ui/button'
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon'
import { useScroll } from '@/components/ui/use-scroll'
import { cn } from '@/lib/utils'

// ── Dropdown spring config (from navbar-menu.tsx) ────────────────────────────

const springTransition = {
  type: 'spring' as const,
  mass: 0.5,
  damping: 11.5,
  stiffness: 100,
  restDelta: 0.001,
  restSpeed: 0.001,
}

// ── Nav link definitions ──────────────────────────────────────────────────────

type NavItem =
  | { label: string; href: string; dropdown?: never }
  | { label: string; href?: never; dropdown: { label: string; href: string }[] }

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Use Cases',
    dropdown: [
      { label: 'Code Review', href: '/code-review' },
      { label: 'Agents', href: '/agents' },
      { label: 'Product Management', href: '/product-management' },
    ],
  },
  { label: 'Documentation', href: '#' },
  { label: 'Pricing', href: '#' },
  {
    label: 'Resources',
    dropdown: [
      { label: 'Blog', href: '/blog' },
      { label: 'Support', href: '/support' },
    ],
  },
]

const MOBILE_ITEMS: { label: string; href: string }[] = [
  { label: 'Code Review', href: '/code-review' },
  { label: 'Agents', href: '/agents' },
  { label: 'Product Management', href: '/product-management' },
  { label: 'Documentation', href: '#' },
  { label: 'Pricing', href: '#' },
  { label: 'Blog', href: '/blog' },
  { label: 'Support', href: '/support' },
]

// ── Hover dropdown item ───────────────────────────────────────────────────────

function DropdownMenuItem({
  item,
  active,
  setActive,
}: {
  item: Extract<NavItem, { dropdown: NonNullable<NavItem['dropdown']> }>
  active: string | null
  setActive: (item: string | null) => void
}) {
  const isOpen = active === item.label

  return (
    <div
      className="relative"
      onMouseEnter={() => setActive(item.label)}
      onMouseLeave={() => setActive(null)}
    >
      {/* Trigger */}
      <button
        type="button"
        className={cn(
          'flex cursor-pointer items-center gap-1 text-[15px] font-normal font-sans transition-all duration-200',
          isOpen ? 'opacity-75' : 'text-white opacity-100 hover:opacity-75',
        )}
      >
        {item.label}
        <motion.svg
          className="size-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={springTransition}
            layoutId={`dropdown-${item.label}`}
            className="absolute top-[calc(100%+0.75rem)] left-1/2 -translate-x-1/2 pt-1 z-50"
          >
            {/* Arrow */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-black border-l border-t border-white/20" />

            <motion.div
              layout
              className="relative min-w-40 rounded-xl border border-white/20 bg-black/95 backdrop-blur-md shadow-2xl overflow-hidden"
            >
              <div className="p-1 flex flex-col gap-0">
                {item.dropdown.map((child) => (
                  <Link
                    key={child.label}
                    href={child.href}
                    className="block px-3 py-1.5 text-[13px] font-normal text-white opacity-90 hover:opacity-75 rounded-lg transition-all duration-200"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Mobile menu (portal) ──────────────────────────────────────────────────────

type MobileMenuProps = {
  open: boolean
  children: React.ReactNode
}

function MobileMenu({ open, children }: MobileMenuProps) {
  if (!open || typeof window === 'undefined') return null

  return createPortal(
    <div
      id="mobile-menu"
      className="fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden border-t border-white/10 bg-black/95 backdrop-blur-lg md:hidden"
    >
      <div
        data-slot={open ? 'open' : 'closed'}
        className={cn(
          'data-[slot=open]:animate-in data-[slot=open]:zoom-in-97 ease-out',
          'size-full p-4',
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ── Main Navbar ───────────────────────────────────────────────────────────────

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null)
  const scrolled = useScroll(10)

  // Lock body scroll when mobile menu is open
  React.useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-transparent transition-all duration-300',
        scrolled &&
          'border-white/20 bg-black/80 backdrop-blur-lg shadow-[0_1px_0_0_rgba(255,255,255,0.08)]',
      )}
    >
      <nav className="mx-auto flex h-14 w-full max-w-350 items-center justify-between px-8">
        {/* ── Left: Logo ── */}
        <Link href="/" aria-label="ViperAI home" className="hover:opacity-80 transition-opacity">
          <Logo />
        </Link>

        {/* ── Center: Desktop nav ── */}
        <div
          className="hidden md:flex items-center gap-6"
          onMouseLeave={() => setActiveDropdown(null)}
        >
          {NAV_ITEMS.map((item) => {
            if (item.dropdown) {
              return (
                <DropdownMenuItem
                  key={item.label}
                  item={item as Extract<NavItem, { dropdown: NonNullable<NavItem['dropdown']> }>}
                  active={activeDropdown}
                  setActive={setActiveDropdown}
                />
              )
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  'text-[15px] font-normal font-sans text-white opacity-100 hover:opacity-75 hover:bg-transparent transition-all duration-200 px-3',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* ── Right: Download + Mobile toggle ── */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="hidden md:inline-flex cursor-pointer text-[15px] font-sans font-medium h-8 px-5 border-white/30 hover:bg-white hover:text-black hover:border-white transition-all duration-200"
          >
            Download
          </Button>

          {/* Mobile hamburger */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-white hover:bg-white/10"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label="Toggle menu"
          >
            <MenuToggleIcon open={mobileOpen} className="size-5" duration={300} />
          </Button>
        </div>
      </nav>

      {/* ── Mobile menu ── */}
      <MobileMenu open={mobileOpen}>
        <div className="flex flex-col justify-between h-full">
          <div className="grid gap-y-1">
            {MOBILE_ITEMS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  'justify-start text-white text-sm font-medium hover:bg-white/10',
                )}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex flex-col gap-2 pb-4">
            <Button className="w-full" onClick={() => setMobileOpen(false)}>
              Download
            </Button>
          </div>
        </div>
      </MobileMenu>
    </header>
  )
}
