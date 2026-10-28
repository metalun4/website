import { build } from "esbuild";

await build({
  entryPoints: ["src/lib/exam-import/worker-entry.ts"],
  outfile: "src/lib/exam-import/pdf-worker.generated.mjs",
  bundle: true, platform: "node", format: "esm", target: "node24",
  external: ["pdfjs-dist/*"], minify: true, legalComments: "eof",
});
