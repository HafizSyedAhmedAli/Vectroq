import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ships a native binary; react-pdf must also run as-is server-side.
  serverExternalPackages: ["sharp", "@react-pdf/renderer"],
  transpilePackages: [
    "@vectroq/shared-types",
    "@vectroq/lead-intake",
    "@vectroq/boq-engine",
    "@vectroq/rate-cards",
    "@vectroq/cad-parser",
    "@vectroq/db",
  ],

  async headers() {
    const SECURITY_HEADERS = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      },
    ];

    return [
      {
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        source: "/((?!embed/).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
      { source: "/:path*", headers: SECURITY_HEADERS },
    ];
  },
};

export default nextConfig;
