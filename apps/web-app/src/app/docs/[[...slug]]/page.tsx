import { source } from '@/lib/source'
import { notFound, redirect } from 'next/navigation'
import DocsLayout from '@/components/docs/DocsLayout'
import MDXComponents from '@/components/docs/MDXComponents'
import CopyMarkdownButton from '@/components/docs/CopyMarkdownButton'
import { NAV_CONFIG } from '@/lib/nav-config'
import Link from 'next/link'
import type { MDXComponents as MDXComponentsType } from 'mdx/types'
import fs from 'fs'
import path from 'path'

interface Props {
  params: Promise<{ slug?: string[] }>
}

export async function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  if (!slug) return {}
  const page = source.getPage(slug)
  if (!page) return {}
  return {
    title: `${page.data.title} — Viper AI Docs`,
    description: page.data.description,
  }
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params
  if (!slug) redirect('/docs/guide/introduction')

  const page = source.getPage(slug)
  if (!page) notFound()

  // fumadocs-mdx injects body at runtime via webpack loader
  const MDX = (page.data as unknown as { body: React.FC<{ components?: MDXComponentsType }> }).body

  // Read raw MDX for Copy Markdown button
  const candidates = [
    path.join(process.cwd(), 'src/content/docs', `${slug.join('/')}.mdx`),
    path.join(process.cwd(), 'src/content/docs', slug.join('/'), 'index.mdx'),
  ]
  const rawMdx = candidates.reduce<string>((acc, p) => {
    if (acc) return acc
    try { return fs.readFileSync(p, 'utf-8') } catch { return '' }
  }, '')

  const allItems = NAV_CONFIG.flatMap((g) => g.items)
  const currentIndex = allItems.findIndex(
    (item) => item.slug.join('/') === slug.join('/')
  )
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null
  const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null

  return (
    <DocsLayout currentSlug={slug} prevItem={prevItem} nextItem={nextItem}>
      {/* Arrows — top right */}
      <div className="flex justify-end mb-3">
        <div className="flex items-center gap-2">
          {prevItem ? (
            <Link
              href={`/docs/${prevItem.slug.join('/')}`}
              title={prevItem.label}
              className="flex size-8 items-center justify-center rounded-lg border border-white/12 text-neutral-400 hover:text-white hover:border-white/30 transition-all duration-150"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </Link>
          ) : (
            <span className="flex size-8 items-center justify-center rounded-lg border border-white/6 text-neutral-700 cursor-not-allowed">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </span>
          )}
          {nextItem ? (
            <Link
              href={`/docs/${nextItem.slug.join('/')}`}
              title={nextItem.label}
              className="flex size-8 items-center justify-center rounded-lg border border-white/12 text-neutral-400 hover:text-white hover:border-white/30 transition-all duration-150"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ) : (
            <span className="flex size-8 items-center justify-center rounded-lg border border-white/6 text-neutral-700 cursor-not-allowed">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-3">
        <h1 className="text-4xl font-bold tracking-tight text-white mb-3">
          {page.data.title}
        </h1>
        <p className="text-neutral-400 text-base leading-relaxed">
          {page.data.description}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mb-7 mt-4">
        <a
          href={`https://github.com/viperaiinc/viper/blob/main/apps/web-app/src/content/docs/${slug.join('/')}.mdx`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 border border-white/10 rounded-md hover:border-white/25 hover:text-white transition-all duration-150"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
          </svg>
          Edit on GitHub
        </a>
        <CopyMarkdownButton content={rawMdx} />
      </div>

      <hr className="border-white/8 mb-10" />

      {/* MDX content */}
      <div className="prose-doc">
        <MDX components={MDXComponents} />
      </div>
    </DocsLayout>
  )
}
