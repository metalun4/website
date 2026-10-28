import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "pdf-lib"],
  outputFileTracingIncludes: {
    "/yks27/admin": ["./src/lib/exam-import/pdf-worker.generated.mjs", "./node_modules/pdfjs-dist/package.json", "./node_modules/pdfjs-dist/legacy/build/pdf.mjs", "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  experimental: { serverActions: { bodySizeLimit: "2300kb" } },
};

export default nextConfig;
