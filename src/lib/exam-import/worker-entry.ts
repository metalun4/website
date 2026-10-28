import { parentPort, workerData } from "node:worker_threads";
import { extractPdf } from "./extract";
import { parsePdf } from "./parse";
import { ImportError } from "./types";

// Built into a server artifact by scripts/build-pdf-worker.mjs. The entire
// untrusted extraction, including PDF/font decompression, runs off the web
// request thread and can be forcibly terminated by its parent.
try {
  const report = parsePdf(await extractPdf(new Uint8Array(workerData.bytes)));
  parentPort!.postMessage({ report });
} catch (error) {
  parentPort!.postMessage({ error: error instanceof ImportError ? { code: error.code, message: error.message } : { code: "PDF", message: "PDF okunamadı. Metin içeren bireysel TYT raporunu yükleyin." } });
}
