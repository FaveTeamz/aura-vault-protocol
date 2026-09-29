import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? require("@next/bundle-analyzer")({ enabled: true })
    : (config: NextConfig) => config;

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
        // Short cache for HTML pages
        source: "/:path*",
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
    ];
  // next-intl's plugin uses experimental.turbo (Next.js <15 key) which is
  // rejected by Next.js 16. We manually wire the alias under the top-level
  // `turbopack` key that Next.js 16 requires.
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
  },
};

export default withNextIntl(nextConfig);
export default withBundleAnalyzer(nextConfig);
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
