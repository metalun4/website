import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolated previews must not share a cache or dev lock with normal Next.
  distDir: process.env.YKS_ISOLATED === "1" ? ".next-isolated" : ".next",
  devIndicators: process.env.YKS_ISOLATED === "1" ? false : undefined,
  serverExternalPackages: ["pdfjs-dist", "pdf-lib"],
  outputFileTracingIncludes: {
    "/yks27/admin": ["./src/lib/exam-import/pdf-worker.generated.mjs", "./node_modules/pdfjs-dist/package.json", "./node_modules/pdfjs-dist/legacy/build/pdf.mjs", "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  experimental: {
    agentUpgrade: "security",
    serverActions: { bodySizeLimit: "2300kb" },
  },
};

export default nextConfig;
