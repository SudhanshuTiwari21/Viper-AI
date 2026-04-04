'use client'

import type { ComponentProps, ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { XIcon } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

/* ─── Types ─────────────────────────────────────────────────── */

interface FooterLink {
  title: string
  href: string
  /** Opens in new tab (external https or explicit) */
  external?: boolean
}

interface FooterSection {
  label: string
  links: FooterLink[]
}

const GITHUB_REPO_URL = 'https://github.com/viperaiinc/viper'
const DISCORD_INVITE_URL = 'https://discord.gg/hxAvwyAVkb'
/** Replace with your X handle when ready, e.g. https://x.com/viper_ai */
const X_COMMUNITY_URL = 'https://x.com'

/* ─── Content ────────────────────────────────────────────────── */

const footerLinks: FooterSection[] = [
  {
    label: 'Product',
    links: [
      { title: 'Agents', href: '/agents' },
      { title: 'Changelog', href: '/changelog' },
      { title: 'Pricing', href: '/pricing' },
      { title: 'Coming soon', href: '/changelog#whats-next' },
    ],
  },
  {
    label: 'Company',
    links: [
      { title: 'About', href: '/about' },
      { title: 'Careers', href: '/careers' },
      { title: 'Contact', href: '/contact' },
    ],
  },
  {
    label: 'Legal',
    links: [
      { title: 'Terms & Conditions', href: '/terms' },
      { title: 'Privacy Policy', href: '/privacy' },
      { title: 'Contact Us', href: '/contact' },
    ],
  },
]

function FooterTextLink({ link, className }: { link: FooterLink; className: string }) {
  const { title, href, external } = link
  const showExternalGlyph = external && href.startsWith('http')

  const inner = (
    <>
      {title}
      {showExternalGlyph && <span className="ml-0.5 text-[11px] leading-none" aria-hidden="true">↗</span>}
    </>
  )

  if (href.startsWith('mailto:')) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    )
  }

  if (href.startsWith('http')) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  )
}

/* ─── Discord icon (not in lucide-react) ────────────────────── */

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.045.034.059a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
}

/* ─── Animation wrapper ──────────────────────────────────────── */

type AnimatedContainerProps = {
  delay?: number
  className?: ComponentProps<typeof motion.div>['className']
  children: ReactNode
}

function AnimatedContainer({ className, delay = 0.1, children }: AnimatedContainerProps) {
  const shouldReduceMotion = useReducedMotion()
  if (shouldReduceMotion) return <>{children}</>

  return (
    <motion.div
      initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
      whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const linkClass =
  'inline-flex items-center gap-0.5 text-[14px] text-neutral-500 hover:text-white transition-colors duration-200'

/* ─── Footer ─────────────────────────────────────────────────── */

export default function Footer() {
  return (
    <footer className="relative w-full border-t border-border-muted bg-black px-8 py-16 lg:py-20">
      <div className="absolute top-0 left-1/2 h-px w-1/3 -translate-x-1/2 rounded-full bg-white/10 blur-sm" />

      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row md:justify-between md:items-start gap-12">
        <AnimatedContainer className="flex flex-col gap-3 translate-x-25" delay={0.1}>
          <Link href="/" className="inline-flex w-fit rounded-md outline-offset-4 hover:opacity-90 transition-opacity" aria-label="Viper AI home">
            <Logo />
          </Link>

          <div className="mt-3 flex flex-col gap-1">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] text-neutral-500 hover:text-white transition-colors duration-200 w-fit"
            >
              MIT Licensed
            </a>
            <p className="text-[14px] text-neutral-500">
              Copyright &copy; {new Date().getFullYear()} Viper AI Inc.
            </p>
          </div>

          <div className="flex items-center gap-4 mt-3">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Viper AI on GitHub"
              className="text-neutral-400 hover:text-white transition-colors duration-200"
            >
              <GitHubIcon className="size-5.5" />
            </a>
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Viper AI on Discord"
              className="text-neutral-400 hover:text-white transition-colors duration-200"
            >
              <DiscordIcon className="size-5.5" />
            </a>
            <a
              href={X_COMMUNITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Viper AI on X"
              className="text-neutral-400 hover:text-white transition-colors duration-200"
            >
              <XIcon className="size-5.5" strokeWidth={1.75} />
            </a>
          </div>
        </AnimatedContainer>

        <div className="flex gap-14 md:gap-20 -translate-x-20">
          {footerLinks.map((section, index) => (
            <AnimatedContainer key={section.label} delay={0.15 + index * 0.1}>
              <h4 className="text-[14px] font-medium text-white mb-4">{section.label}</h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.title}>
                    <FooterTextLink link={link} className={linkClass} />
                  </li>
                ))}
              </ul>
            </AnimatedContainer>
          ))}
        </div>
      </div>
    </footer>
  )
}
