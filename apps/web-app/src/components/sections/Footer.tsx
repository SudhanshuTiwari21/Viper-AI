import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

const PRODUCT_LINKS = [
  { label: 'Agents', href: '#' },
  { label: 'Changelog', href: '#' },
  { label: 'Pricing', href: '#' },
  { label: 'Download', href: '#' },
]

const COMPANY_LINKS = [
  { label: 'About', href: '#' },
  { label: 'Careers', href: '#' },
  { label: 'Contact', href: '#' },
]

const SOCIAL_LINKS = [
  { label: 'Twitter / X', href: '#' },
  { label: 'GitHub', href: '#' },
  { label: 'Discord', href: '#' },
]

function FooterLinkGroup({
  heading,
  links,
}: {
  heading: string
  links: { label: string; href: string }[]
}) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white mb-8">
        {heading}
      </h4>
      <ul className="space-y-4">
        {links.map(({ label, href }) => (
          <li key={label}>
            <Link
              href={href}
              className="text-[13px] text-neutral-500 hover:text-white transition-colors"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Footer() {
  return (
    <footer className="py-24 px-8 border-t border-border-muted bg-black">
      <div className="max-w-[1400px] mx-auto">
        {/* Top grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-20">
          {/* Brand */}
          <div className="col-span-2">
            <div className="mb-8">
              <Logo />
            </div>
            <p className="text-neutral-500 text-xs max-w-xs leading-relaxed uppercase tracking-[0.1em]">
              The autonomous engineering platform for high-growth teams.
            </p>
          </div>

          <FooterLinkGroup heading="Product" links={PRODUCT_LINKS} />
          <FooterLinkGroup heading="Company" links={COMPANY_LINKS} />
          <FooterLinkGroup heading="Social" links={SOCIAL_LINKS} />
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border-muted flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] uppercase tracking-widest text-neutral-600">
            &copy; 2024 Viper AI Inc.
          </p>
          <div className="flex gap-8">
            <Link
              href="#"
              className="text-[10px] uppercase tracking-widest text-neutral-600 hover:text-white transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-[10px] uppercase tracking-widest text-neutral-600 hover:text-white transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
