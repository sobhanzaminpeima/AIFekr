/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a deploy build into a scratch directory and swap it in afterwards,
  // instead of `rm -rf .next && npm run build` on the live server. That
  // sequence deletes the build out from under the running process, so every
  // page not already in memory returns 500 for the whole ~10-minute build —
  // measured on 2026-09-06: 24 of 39 page/language probes failed mid-deploy
  // while pm2 had not restarted at all. Unset in normal use, so `npm run dev`
  // and a local build behave exactly as before.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "*.fal.ai" },
    ],
    unoptimized: true,
  },
};

export default nextConfig;
