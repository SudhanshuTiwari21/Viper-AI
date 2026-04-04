import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — Viper AI',
  description:
    'Builder ($20/mo) for AI-native code editing. Product ($40/mo) adds PM integrations. Team plans for SSO, audit, and pooled usage.',
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
