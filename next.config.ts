import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['stripe'],
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(self), microphone=(self), geolocation=(self)',
        },
        {
          key: 'Content-Security-Policy',
          value:
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com https://*.vercel-insights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://auth.purama.dev https://*.stripe.com; connect-src 'self' https://auth.purama.dev wss://auth.purama.dev https://*.stripe.com https://*.vercel-insights.com; frame-src https://*.stripe.com;",
        },
      ],
    },
  ],
};

export default nextConfig;
