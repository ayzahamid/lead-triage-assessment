import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  ...(process.env.BUILD_STANDALONE === '1' ? { output: 'standalone' as const } : {}),
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion', 'motion/react'],
  },
  images: { unoptimized: true },
  poweredByHeader: false,
}

export default nextConfig
