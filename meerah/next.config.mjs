/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // The browser talks to /api/* on its own origin; Next forwards to the API
    // process. Keeps the API key and session handling server-side and avoids
    // CORS entirely.
    return [
      { source: '/api/:path*', destination: `${process.env.API_URL ?? 'http://localhost:3001'}/api/:path*` },
    ];
  },
};
export default nextConfig;
