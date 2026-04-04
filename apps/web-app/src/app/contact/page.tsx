import Navbar from '@/components/sections/Navbar'
import Footer from '@/components/sections/Footer'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contact — Viper AI',
  description: 'Reach Viper AI — email, Discord, and support.',
}

export default function ContactPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-black font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-8 py-20 md:py-28">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500">Company</p>
        <h1 className="mb-8 text-4xl font-medium tracking-tight text-white md:text-5xl">Contact</h1>
        <div className="space-y-8 text-neutral-400 text-base font-light leading-relaxed">
          <div>
            <h2 className="mb-2 text-sm font-medium text-white">Email</h2>
            <a
              href="mailto:info@viperai.tech"
              className="text-neutral-200 underline underline-offset-4 hover:text-white"
            >
              info@viperai.tech
            </a>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium text-white">Community</h2>
            <a
              href="https://discord.gg/hxAvwyAVkb"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-200 underline underline-offset-4 hover:text-white"
            >
              Discord — Viper AI
            </a>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium text-white">Help &amp; status</h2>
            <Link href="/support" className="text-neutral-200 underline underline-offset-4 hover:text-white">
              Support center
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
