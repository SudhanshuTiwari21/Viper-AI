import 'server-only'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
export { NAV_CONFIG } from './nav-config'

export interface DocMeta {
  title: string
  description: string
  section: string
  prev: string | null
  next: string | null
}

export interface Doc {
  slug: string[]
  meta: DocMeta
  content: string
}

const CONTENT_DIR = path.join(process.cwd(), 'src/content/docs')

export function getDocBySlug(slug: string[]): Doc | null {
  const slugPath = slug.join('/')

  // Try direct path first, then index
  const candidates = [
    path.join(CONTENT_DIR, `${slugPath}.mdx`),
    path.join(CONTENT_DIR, slugPath, 'index.mdx'),
  ]

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const { data, content } = matter(raw)
      return {
        slug,
        meta: data as DocMeta,
        content,
      }
    }
  }

  return null
}

export function getAllDocSlugs(): string[][] {
  const slugs: string[][] = []

  function walk(dir: string, base: string[] = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...base, entry.name])
      } else if (entry.name.endsWith('.mdx')) {
        const name = entry.name.replace(/\.mdx$/, '')
        if (name === 'index') {
          slugs.push(base)
        } else {
          slugs.push([...base, name])
        }
      }
    }
  }

  walk(CONTENT_DIR)
  return slugs
}

