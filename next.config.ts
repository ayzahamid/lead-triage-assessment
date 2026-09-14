import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Standalone emits a self-contained server bundle, which the Docker runtime stage needs and
  // Vercel does not. Gated so one repo builds correctly for both targets.
  ...(process.env.BUILD_STANDALONE === '1' ? { output: 'standalone' as const } : {}),

  experimental: {
    // Rewrites barrel imports into direct file imports at build time. lucide-react is the
    // reason: importing five icons from its index would otherwise pull the whole set into
    // the module graph.
    optimizePackageImports: ['lucide-react', 'motion', 'motion/react'],
  },

  // The app has no remote images and no runtime image work; keep the loader out of the bundle.
  images: { unoptimized: true },

  poweredByHeader: false,
}

export default nextConfig
