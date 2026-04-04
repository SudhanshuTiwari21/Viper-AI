import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About — Viper AI',
  description: 'Viper AI builds a hosted engineering workspace that unifies product context, code, and AI.',
}

export default function AboutPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-black font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-8 py-20 md:py-28">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500">Company</p>
        <h1 className="mb-8 text-4xl font-medium tracking-tight text-white md:text-5xl">About Viper AI</h1>
        <div className="space-y-6 text-neutral-400 text-base font-light leading-relaxed">
          <p>
            Viper AI Inc. builds software for teams who ship real products. We believe context should not
            disappear every time you jump between PM tools, docs, and AI chat—so we are building a hosted
            workspace where intent, repository state, and assistants stay aligned.
          </p>
          <p>
            We are not replacing Jira or Linear; we integrate them. Engineers keep their workflow; Viper
            connects the dots so agents and humans work from one thread.
          </p>
          <p>
            Questions?{' '}
            <a href="mailto:info@viperai.tech" className="text-neutral-200 underline underline-offset-4 hover:text-white">
              info@viperai.tech
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
