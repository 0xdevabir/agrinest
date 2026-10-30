import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    const api = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000'
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/storage/:path*', destination: `${api}/storage/:path*` },
    ]
  },
}

export default nextConfig
