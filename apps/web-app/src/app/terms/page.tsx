import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions — Viper AI',
  description: 'Terms and conditions for using Viper AI products and websites.',
}

export default function TermsPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-black font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-8 py-20 md:py-28">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500">Legal</p>
        <h1 className="mb-8 text-4xl font-medium tracking-tight text-white md:text-5xl">Terms &amp; Conditions</h1>
        <div className="space-y-6 text-sm text-neutral-400 font-light leading-relaxed">
          <p className="text-amber-200/90">
            This page is a placeholder summary. Formal terms will be published before general availability. Until
            then, use of preview or internal builds is governed by any agreement you sign with Viper AI Inc.
          </p>
          <p>
            The Viper AI website and applications are provided by Viper AI Inc. By accessing our sites or services
            you agree to comply with applicable laws and any separate contract (for example enterprise order forms
            or beta agreements).
          </p>
          <p>
            Software offered under an open-source license (such as MIT) is governed by the license file in the
            corresponding repository, not solely by this page.
          </p>
          <p className="text-neutral-500">
            Questions:{' '}
            <a href="mailto:info@viperai.tech" className="text-neutral-300 underline underline-offset-4 hover:text-white">
              info@viperai.tech
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
