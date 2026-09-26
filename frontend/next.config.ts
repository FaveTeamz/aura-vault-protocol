import type { NextConfig } from "next";

// Sentry is an optional peer-dep — wrap with a try/catch so the build works
// before `npm install @sentry/nextjs` is run.
let withSentryConfig: (config: NextConfig, opts: Record<string, unknown>) => NextConfig;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  withSentryConfig = require("@sentry/nextjs").withSentryConfig;
} catch {
  withSentryConfig = (config) => config; // passthrough if Sentry not installed
}

const nextConfig: NextConfig = {
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    deviceSizes: [320, 640, 768, 1024, 1280, 1920, 2560],
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Organisation and project are read from SENTRY_ORG and SENTRY_PROJECT env vars
  // or can be set explicitly here.
  silent: true,

  // Upload source maps on every production build so Sentry can de-obfuscate
  // stack traces.  Set SENTRY_AUTH_TOKEN in CI.
  widenClientFileUpload: true,
  hideSourceMaps: true,

  // Automatically instrument Next.js pages and route handlers.
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,

  // Disable the Sentry CLI telemetry upload
  disableLogger: true,
});
