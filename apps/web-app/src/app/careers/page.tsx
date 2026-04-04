import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Careers — Viper AI',
  description: 'Join Viper AI — we hire builders who care about developer experience and product craft.',
}

export default function CareersPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-black font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-8 py-20 md:py-28">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500">Company</p>
        <h1 className="mb-8 text-4xl font-medium tracking-tight text-white md:text-5xl">Careers</h1>
        <div className="space-y-6 text-neutral-400 text-base font-light leading-relaxed">
          <p>
            We are a small team working on hard problems at the intersection of IDEs, LLMs, and enterprise
            workflows. If that sounds interesting, we would like to hear from you—even if there is no open
            role listed yet.
          </p>
          <p>
            Send a short note and a link to your work (GitHub, portfolio, or PDF) to{' '}
            <a href="mailto:info@viperai.tech?subject=Careers" className="text-neutral-200 underline underline-offset-4 hover:text-white">
              info@viperai.tech
            </a>{' '}
            with the subject line <span className="text-neutral-300">Careers</span>.
          </p>
          <p className="text-sm text-neutral-500">
            We review every message. Public openings will also be posted here when we scale hiring.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
