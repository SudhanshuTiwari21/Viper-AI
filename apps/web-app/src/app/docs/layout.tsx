import type { ReactNode } from 'react'
import Navbar from '@/components/sections/Navbar'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Navbar />
      {children}
    </div>
  )
}
