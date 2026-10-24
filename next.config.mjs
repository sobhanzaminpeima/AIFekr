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
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer", "pdf-parse"],
    ...(process.env.NEXT_BUILD_CPUS ? { cpus: Number(process.env.NEXT_BUILD_CPUS) } : {}),
  },
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
  async headers() {
    const base = [
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
    ];
    return [
      // Lead forms (/f/<slug>) are embedded on customers' own sites by
      // /api/public/leadform/<slug>/embed, so only they may be framed.
      { source: "/f/:path*", headers: base },
      { source: "/((?!f/).*)", headers: [...base, { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
    ];
  },
};

export default nextConfig;
