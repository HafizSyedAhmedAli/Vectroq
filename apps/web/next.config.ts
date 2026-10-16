import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ships a native binary; react-pdf must also run as-is server-side.
  serverExternalPackages: ["sharp", "@react-pdf/renderer"],
  transpilePackages: [
    "@buildquote/shared-types",
    "@buildquote/lead-intake",
    "@buildquote/boq-engine",
    "@buildquote/rate-cards",
    "@buildquote/cad-parser",
    "@buildquote/db",
  ],
  outputFileTracingIncludes: {
    "/api/projects/[id]/boq-pdf": ["./public/logo.png"],
  },
};

export default nextConfig;
