import type { MDXComponents } from 'mdx/types'
import Link from 'next/link'

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim()
}

const components: MDXComponents = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold tracking-tight text-white mt-10 mb-4 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const id = slugify(String(children))
    return (
      <h2
        id={id}
        className="text-2xl font-bold tracking-tight text-white mt-10 mb-4 scroll-mt-24 group flex items-center gap-2"
      >
        <a href={`#${id}`} className="opacity-0 group-hover:opacity-40 transition-opacity text-neutral-400 text-lg">#</a>
        {children}
      </h2>
    )
  },
  h3: ({ children }) => {
    const id = slugify(String(children))
    return (
      <h3
        id={id}
        className="text-lg font-semibold text-white mt-8 mb-3 scroll-mt-24 group flex items-center gap-2"
      >
        <a href={`#${id}`} className="opacity-0 group-hover:opacity-40 transition-opacity text-neutral-400 text-sm">#</a>
        {children}
      </h3>
    )
  },
  h4: ({ children }) => (
    <h4 className="text-base font-semibold text-white mt-6 mb-2">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-neutral-300 text-[15px] leading-7 mb-5">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-neutral-200 italic">{children}</em>
  ),
  a: ({ href, children }) => {
    const isExternal = href?.startsWith('http')
    if (isExternal) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white underline underline-offset-4 decoration-white/30 hover:decoration-white transition-all duration-150"
        >
          {children}
        </a>
      )
    }
    return (
      <Link
        href={href ?? '#'}
        className="text-white underline underline-offset-4 decoration-white/30 hover:decoration-white transition-all duration-150"
      >
        {children}
      </Link>
    )
  },
  ul: ({ children }) => (
    <ul className="space-y-2 mb-5 ml-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-3 mb-5 ml-4 list-none counter-reset-[item]">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-neutral-300 text-[15px] leading-7 flex gap-3 items-start">
      <span className="mt-2 size-1.5 rounded-full bg-neutral-600 shrink-0" />
      <span>{children}</span>
    </li>
  ),
  hr: () => <hr className="border-white/8 my-8" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-white/20 pl-4 my-5 text-neutral-400 italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    // Inline code
    if (!className) {
      return (
        <code className="bg-white/8 text-neutral-200 text-[13px] font-mono px-1.5 py-0.5 rounded">
          {children}
        </code>
      )
    }
    return <code className={className}>{children}</code>
  },
  pre: ({ children }) => (
    <pre className="bg-[#050505] border border-white/10 rounded-lg p-5 overflow-x-auto my-6 text-[13px] font-mono leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-6">
      <table className="w-full text-[14px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-white/10">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-white/5 hover:bg-white/2 transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-neutral-500">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="py-3 px-4 text-neutral-300">{children}</td>
  ),
}

export default components
