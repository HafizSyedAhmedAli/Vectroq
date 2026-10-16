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
  outputFileTracingIncludes: {
    "/api/projects/[id]/boq-pdf": ["./public/logo.png"],
  },
};

export default nextConfig;
