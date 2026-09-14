import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Emits a minimal self-contained server bundle for the Docker runtime stage.
  output: 'standalone',

  experimental: {
    // Rewrites barrel imports into direct file imports at build time. lucide-react is the
    // reason: importing five icons from its index would otherwise pull the whole set into
    // the module graph.
    optimizePackageImports: ['lucide-react', 'motion', 'motion/react', '@tanstack/react-virtual'],
  },

  // The app has no remote images and no runtime image work; keep the loader out of the bundle.
  images: { unoptimized: true },

  poweredByHeader: false,
}

export default nextConfig
