import type { Metadata } from 'next'
import { Inter, Orbitron } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
})

export const metadata: Metadata = {
  title: 'Viper AI — The AI Engineering Operating System',
  description:
    'Viper is an autonomous engineering operating system that transforms high-level intent into production-ready software.',
  icons: {
    icon: '/VIPER.svg',
    shortcut: '/VIPER.svg',
    apple: '/VIPER.svg',
  },
  openGraph: {
    title: 'Viper AI — The AI Engineering Operating System',
    description:
      'Viper is an autonomous engineering operating system that transforms high-level intent into production-ready software.',
    type: 'website',
    siteName: 'Viper AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viper AI — The AI Engineering Operating System',
    description:
      'Viper is an autonomous engineering operating system that transforms high-level intent into production-ready software.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${orbitron.variable} font-sans bg-[#09090b] text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
