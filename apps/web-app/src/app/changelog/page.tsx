import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Changelog — Viper AI',
  description: 'Release notes and what is shipping next for Viper AI.',
}

const ENTRIES = [
  {
    version: 'Unreleased',
    date: 'In progress',
    items: [
      'Hosted desktop and web clients rolling out with early access.',
      'Chat modes (Ask, Plan, Debug, Agent) and Auto / Premium usage model.',
      'PM-integrated workspace (Align / Studio) in active development.',
    ],
  },
  {
    version: '0.1.0',
    date: 'Internal',
    items: ['Monorepo foundation: backend API, Viper Desktop, and marketing site.'],
  },
]

export default function ChangelogPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-black font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-8 py-20 md:py-28">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500">Product</p>
        <h1 id="top" className="mb-4 text-4xl font-medium tracking-tight text-white md:text-5xl">
          Changelog
        </h1>
        <p className="mb-14 text-neutral-400 text-base font-light leading-relaxed">
          Highlights from recent work. For install status and access, see{' '}
          <Link href="/support" className="text-neutral-200 underline underline-offset-4 hover:text-white">
            Support
          </Link>
          .
        </p>
        <div className="space-y-14">
          {ENTRIES.map((entry) => (
            <section key={entry.version} id={entry.version === 'Unreleased' ? 'whats-next' : undefined}>
              <div className="mb-4 flex flex-wrap items-baseline gap-3">
                <h2 className="text-xl font-medium text-white">{entry.version}</h2>
                <span className="text-sm text-neutral-500">{entry.date}</span>
              </div>
              <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-400 font-light leading-relaxed">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
