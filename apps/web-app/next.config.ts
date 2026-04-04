import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/docs/guide/introduction', destination: '/docs/guide/welcome', permanent: true },
      { source: '/docs/guide/installation', destination: '/docs/guide/for-developers', permanent: true },
      { source: '/docs/guide/architecture', destination: '/docs/guide/for-developers', permanent: true },
      { source: '/docs/guide/integrations', destination: '/docs/guide/workspace-privacy', permanent: true },
      { source: '/docs/guide/accessibility', destination: '/docs/guide/welcome', permanent: true },
      { source: '/docs/guide/changelog', destination: '/docs/guide/welcome', permanent: true },
      { source: '/docs/guide/roadmap', destination: '/docs/guide/welcome', permanent: true },
      { source: '/docs/components', destination: '/docs/guide/welcome', permanent: true },
      { source: '/docs/components/:path*', destination: '/docs/guide/welcome', permanent: true },
      { source: '/docs/primitives', destination: '/docs/guide/welcome', permanent: true },
      { source: '/docs/primitives/:path*', destination: '/docs/guide/welcome', permanent: true },
      { source: '/docs/icons', destination: '/docs/guide/welcome', permanent: true },
      { source: '/docs/icons/:path*', destination: '/docs/guide/welcome', permanent: true },
    ]
  },
}

export default withMDX(nextConfig)
