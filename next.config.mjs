/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The card images read a bundled font file at runtime; make sure serverless builds ship it.
  experimental: {
    outputFileTracingIncludes: {
      '/card/**': ['./src/assets/**'],
      '/d/**': ['./src/assets/**'],
    },
  },
  async headers() {
    // No Content-Security-Policy on purpose: the Threadline embed loads a
    // third-party script and talks to its own API. Add a CSP only after
    // confirming Threadline's required origins.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default nextConfig;
