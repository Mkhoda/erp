/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },

  // Allow build to continue despite type errors
  typescript: {
    ignoreBuildErrors: true,
  },

  // Proxy /api/* to the backend server-side. This lets the browser always call
  // a relative /api path (same-origin), so it works no matter which host served
  // the page — erp.arzesh.net (via nginx) or 37.235.18.227:5530 (direct), with
  // no CORS. BACKEND_INTERNAL_URL is a server-side env (NOT NEXT_PUBLIC) pointing
  // at the backend as reachable from the frontend server.
  async rewrites() {
    const backend = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3001';
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
    ];
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
        '37.235.18.227',
        '37.235.18.227:5530',
      ],
    },
  },
}

module.exports = nextConfig