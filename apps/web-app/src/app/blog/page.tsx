'use client'

import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import ShimmerButton from '@/components/ui/shimmer-button'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Post {
  slug: string
  tag: string
  title: string
  excerpt: string
  date: string
  readTime: string
  featured?: boolean
}

// ── Blog Data ──────────────────────────────────────────────────────────────────

const POSTS: Post[] = [
  {
    slug: 'why-current-ai-coding-tools-miss-the-point',
    tag: 'Engineering',
    title: 'Why Current AI Coding Tools Miss the Point',
    excerpt:
      'Copilot and ChatGPT complete lines. They don\'t understand systems. The next generation of AI tooling isn\'t about autocomplete — it\'s about architecture-aware execution that knows your codebase as well as your senior engineer does.',
    date: 'March 18, 2026',
    readTime: '8 min read',
    featured: true,
  },
  {
    slug: 'introducing-viper-the-ai-engineering-os',
    tag: 'Announcement',
    title: 'Introducing Viper: The AI Engineering Operating System',
    excerpt:
      'Today we\'re sharing what we\'ve been building. Viper is not another AI coding assistant. It\'s an autonomous engineering operating system that transforms high-level intent into production-ready software.',
    date: 'February 28, 2026',
    readTime: '5 min read',
    featured: true,
  },
  {
    slug: 'how-context-loss-kills-developer-velocity',
    tag: 'Engineering',
    title: 'How Context Loss Kills Developer Velocity',
    excerpt:
      'The real enemy of developer productivity isn\'t slow tools — it\'s re-explaining your system to every tool you use. Context loss between your PM, your IDE, and your AI is where hours of engineering time disappear every week.',
    date: 'February 12, 2026',
    readTime: '6 min read',
  },
  {
    slug: 'building-autonomous-agents-that-actually-ship',
    tag: 'Engineering',
    title: 'Building Autonomous Agents That Actually Ship',
    excerpt:
      'Most autonomous coding agents are demos. They work beautifully on isolated files in controlled environments. We\'ll share what it took to build agents that operate reliably across real, messy, multi-service production codebases.',
    date: 'January 30, 2026',
    readTime: '11 min read',
  },
  {
    slug: 'from-idea-to-pr-the-viper-development-loop',
    tag: 'Product',
    title: 'From Idea to PR: The Viper Development Loop',
    excerpt:
      'A deep-dive into how Viper connects product intent to code execution. Walk through a real feature request — from a one-sentence prompt to a merged pull request — and see exactly how each layer of the system contributes.',
    date: 'January 14, 2026',
    readTime: '7 min read',
  },
  {
    slug: 'the-architecture-behind-vipers-codebase-intelligence',
    tag: 'Deep Dive',
    title: 'The Architecture Behind Viper\'s Codebase Intelligence',
    excerpt:
      'How do you build an AI that truly understands a large, evolving codebase? We break down our approach to dependency graph indexing, incremental context updates, and the tradeoffs we made to keep reasoning accurate and fast.',
    date: 'December 22, 2025',
    readTime: '14 min read',
  },
  {
    slug: 'pm-agents-bridging-product-and-engineering',
    tag: 'Product',
    title: 'PM Agents: Bridging Product and Engineering at Last',
    excerpt:
      'The gap between a product idea and a scoped engineering ticket has always been filled by painful back-and-forth. Viper\'s PM Agent closes that gap — turning natural language intent into fully-structured, dependency-linked work items.',
    date: 'December 10, 2025',
    readTime: '6 min read',
  },
  {
    slug: 'security-review-at-the-speed-of-code',
    tag: 'Security',
    title: 'Security Review at the Speed of Code',
    excerpt:
      'Security reviews happen too late and catch too little. With Viper\'s Review Agent, every PR gets a full security analysis — OWASP top-10, dependency vulnerabilities, exposed credentials — before a human opens the diff.',
    date: 'November 27, 2025',
    readTime: '9 min read',
  },
]

const TAG_COLORS: Record<string, string> = {
  Engineering: 'text-[#bd93f9]',
  Announcement: 'text-[#50fa7b]',
  Product: 'text-[#ffb86c]',
  'Deep Dive': 'text-[#8be9fd]',
  Security: 'text-[#ff5555]',
}

// ── Featured Post Card ─────────────────────────────────────────────────────────

function FeaturedCard({ post, index }: { post: Post; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  const tagColor = TAG_COLORS[post.tag] ?? 'text-neutral-400'

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.1, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <Link href={`/blog/${post.slug}`} className="group block bg-black border border-border-muted hover:border-border-active transition-colors p-10 md:p-12 h-full">
        <div className="flex items-center gap-3 mb-8">
          <span className={`text-[10px] font-bold tracking-[0.3em] uppercase ${tagColor}`}>
            {post.tag}
          </span>
          <span className="text-neutral-700 text-[10px]">·</span>
          <span className="text-[10px] text-neutral-600 uppercase tracking-widest">{post.readTime}</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-white mb-5 leading-snug group-hover:opacity-80 transition-opacity">
          {post.title}
        </h2>
        <p className="text-neutral-500 text-sm leading-relaxed font-light mb-8 line-clamp-3">
          {post.excerpt}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-neutral-600">{post.date}</span>
          <span className="text-[12px] text-neutral-500 group-hover:text-white transition-colors">
            Read →
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ── Regular Post Card ──────────────────────────────────────────────────────────

function PostCard({ post, index }: { post: Post; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  const tagColor = TAG_COLORS[post.tag] ?? 'text-neutral-400'

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: (index % 3) * 0.1, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <Link href={`/blog/${post.slug}`} className="group block bg-black border border-border-muted hover:border-border-active transition-colors p-8 h-full">
        <div className="flex items-center gap-3 mb-6">
          <span className={`text-[10px] font-bold tracking-[0.3em] uppercase ${tagColor}`}>
            {post.tag}
          </span>
          <span className="text-neutral-700 text-[10px]">·</span>
          <span className="text-[10px] text-neutral-600 uppercase tracking-widest">{post.readTime}</span>
        </div>
        <h3 className="text-xl font-medium tracking-tight text-white mb-4 leading-snug group-hover:opacity-80 transition-opacity">
          {post.title}
        </h3>
        <p className="text-neutral-500 text-sm leading-relaxed font-light mb-6 line-clamp-3">
          {post.excerpt}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-neutral-600">{post.date}</span>
          <span className="text-[12px] text-neutral-500 group-hover:text-white transition-colors">
            Read →
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ── Page Header ────────────────────────────────────────────────────────────────

function Header() {
  return (
    <section className="pt-24 pb-16 px-8 border-b border-border-muted font-sans">
      <div className="max-w-6xl mx-auto">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-6 block"
        >
          Resources / Blog
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-5xl md:text-6xl font-medium tracking-tight leading-none mb-8 max-w-3xl"
        >
          Thinking out loud<br />about engineering.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg font-light leading-relaxed max-w-xl"
        >
          Deep dives into autonomous engineering, AI agent architecture, and the
          future of how software gets built.
        </motion.p>
      </div>
    </section>
  )
}

// ── Featured Posts ─────────────────────────────────────────────────────────────

function FeaturedPosts() {
  const featured = POSTS.filter((p) => p.featured)

  return (
    <section className="py-16 px-8 border-b border-border-muted font-sans">
      <div className="max-w-6xl mx-auto">
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
          Featured
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border-muted border border-border-muted">
          {featured.map((post, i) => (
            <FeaturedCard key={post.slug} post={post} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── All Posts ──────────────────────────────────────────────────────────────────

function AllPosts() {
  const remaining = POSTS.filter((p) => !p.featured)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section ref={ref} className="py-16 px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
            All Posts
          </span>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border-muted border border-border-muted">
          {remaining.map((post, i) => (
            <PostCard key={post.slug} post={post} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Newsletter ─────────────────────────────────────────────────────────────────

function Newsletter() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-32 px-8 border-t border-border-muted font-sans">
      <div className="max-w-3xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-4xl md:text-5xl font-medium tracking-tight mb-8 leading-none"
        >
          Stay in the loop.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-neutral-400 text-lg mb-12 font-light max-w-md mx-auto leading-relaxed"
        >
          New posts on autonomous engineering, agent architecture, and product
          updates. Email signup is coming soon.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-md mx-auto"
        >
          <input
            type="email"
            disabled
            readOnly
            placeholder="you@company.com"
            aria-label="Email (coming soon)"
            className="h-12 flex-1 w-full sm:w-auto cursor-not-allowed bg-black/50 border border-border-muted outline-none px-4 text-sm text-white/50 placeholder:text-neutral-600 font-sans opacity-70"
          />
          <ShimmerButton
            type="button"
            disabled
            aria-disabled="true"
            className="h-12 px-7 text-sm font-semibold cursor-not-allowed opacity-70 hover:scale-100 whitespace-nowrap"
          >
            Coming soon
          </ShimmerButton>
        </motion.div>
      </div>
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BlogPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Header />
        <FeaturedPosts />
        <AllPosts />
        <Newsletter />
      </main>
      <Footer />
    </div>
  )
}
