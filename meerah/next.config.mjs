/** @type {import('next').NextConfig} */
const nextConfig = {
  // Where the build output goes. `next build` has no `--distDir` flag, so an
  // environment variable is the only way to point a build somewhere other than
  // the directory a running `next dev` is reading from — and a production build
  // into that directory wipes the dev server's on-demand chunks, which takes the
  // running site down until each route is requested again and recompiled.
  //
  // Unset, this is exactly the default. Set it to build without disturbing a dev
  // server: `NEXT_DIST_DIR=.next-verify npx next build`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  async rewrites() {
    // The browser talks to /api/* on its own origin; Next forwards to the API
    // process. Keeps the API key and session handling server-side and avoids
    // CORS entirely.
    return [
      { source: '/api/:path*', destination: `${process.env.API_URL ?? 'http://localhost:3001'}/api/:path*` },

      // Vendor UI assets, served from our own origin.
      //
      // The forked studios load option thumbnails straight from the vendor's
      // CDN — 66 requests on Star Maker alone. Nothing appears on screen, but
      // the vendor's name sits in every customer's network log and DevTools,
      // which is the one thing this product promises never to show them.
      //
      // A proxy rather than a download on purpose: copying someone else's asset
      // library into our repo and serving it as ours is a worse position than
      // pointing at it, and these are the vendor's own product images. The
      // browser only ever sees our origin; upstream cache headers pass through,
      // so a returning customer fetches nothing.
      { source: '/vendor-img/:path*',   destination: 'https://cdn.muapi.ai/:path*' },
      { source: '/vendor-asset/:path*', destination: 'https://d3adwkbyhxyrtq.cloudfront.net/:path*' },
    ];
  },
};
export default nextConfig;
