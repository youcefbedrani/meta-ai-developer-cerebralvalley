import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic dynamic rendering: nearly every /app route reads the session cookie,
  // so Cache Components would add Suspense/"use cache" plumbing without real benefit.
  cacheComponents: false,
  // e2e tests run a separate dev server; keep its build output apart from yours.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Self-contained server bundle for the production Docker image.
  output: "standalone",
  serverExternalPackages: ["firebase-admin"],
  poweredByHeader: false,
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Microphone: voice pitches are recorded in the browser on our own pages.
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
      // Allows the Google sign-in popup to talk back to the opener.
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    ];
    return [
      // Everything except generated design screens may never be framed.
      { source: "/:path((?!app/projects/[^/]+/design/[^/]+/html$).*)", headers: [...common, { key: "X-Frame-Options", value: "DENY" }] },
      // Design screens are previewed in iframes on our own pages (and served with a sandbox CSP).
      { source: "/app/projects/:id/design/:screenId/html", headers: [...common, { key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
