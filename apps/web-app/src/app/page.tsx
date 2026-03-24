import Navbar from '@/components/sections/Navbar'
import Hero from '@/components/sections/Hero'
import { VideoScrollHero } from '@/components/ui/video-scroll-hero'
import Features from '@/components/sections/Features'
import CTA from '@/components/sections/CTA'
import Footer from '@/components/sections/Footer'

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <VideoScrollHero />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
