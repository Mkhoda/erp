/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },

  // Allow build to continue despite type/lint errors
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Next.js 16 host-header security: whitelist trusted origins.
  // Without this, static assets and pages return 400 when proxied via nginx
  // with a Host header that differs from localhost.
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost',
        'localhost:3000',
        '127.0.0.1',
        '127.0.0.1:3000',
        '91.92.181.146',
        '91.92.181.146:3000',
        '91.92.181.146:80',
        'erp.arzesh.net',
        'erp.arzesh.net:443',
      ],
    },
  },
}

module.exports = nextConfig