const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy.
 * - 'unsafe-eval' is required by Next.js hot reload in development only.
 * - 'unsafe-inline' styles are required by Tailwind/Next inline style tags.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'" + (isDev ? " ws: wss:" : ""),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: require("./package.json").version,
  },
  experimental: {
    serverComponentsExternalPackages: ["mssql", "msnodesqlv8"],
    instrumentationHook: true,
  },
  /**
   * msnodesqlv8 ships a native .node binary. Webpack must never pull it into
   * a browser bundle or the edge compilation (middleware forces an edge
   * compiler, which also compiles instrumentation.ts). DI uses mock repos in
   * the browser and instrumentation early-returns on edge, so aliasing the
   * driver to an empty module is safe in both.
   */
  webpack: (config, { isServer, nextRuntime }) => {
    if (!isServer || nextRuntime === "edge") {
      config.resolve.alias = {
        ...config.resolve.alias,
        mssql: false,
        "mssql/msnodesqlv8": false,
        msnodesqlv8: false,
        child_process: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
