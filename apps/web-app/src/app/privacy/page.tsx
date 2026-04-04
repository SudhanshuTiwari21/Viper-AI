import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Viper AI',
  description: 'How Viper AI handles information when you use our website and products.',
}

export default function PrivacyPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-black font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-8 py-20 md:py-28">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500">Legal</p>
        <h1 className="mb-8 text-4xl font-medium tracking-tight text-white md:text-5xl">Privacy Policy</h1>
        <div className="space-y-6 text-sm text-neutral-400 font-light leading-relaxed">
          <p className="text-amber-200/90">
            This policy is a high-level draft. A finalized privacy policy will be published before broad public
            launch and may be updated to reflect product and legal requirements.
          </p>
          <p>
            We collect information needed to run the service you use—for example account details you provide,
            usage needed to operate and secure Viper Cloud, and content you send to AI features as described in
            product documentation and your agreement.
          </p>
          <p>
            We do not sell your personal information. Enterprise customers may have additional data processing
            terms in their contracts.
          </p>
          <p>
            For privacy requests or questions, contact{' '}
            <a href="mailto:info@viperai.tech" className="text-neutral-300 underline underline-offset-4 hover:text-white">
              info@viperai.tech
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
