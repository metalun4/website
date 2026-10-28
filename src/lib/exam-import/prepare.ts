import "server-only";
import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { ImportError, type ParsedExam } from "./types";

export function prepareReport(bytes: Uint8Array): Promise<ParsedExam> {
  return new Promise((resolve, reject) => {
    const copy = new Uint8Array(bytes);
    const worker = new Worker(join(process.cwd(), "src/lib/exam-import/pdf-worker.generated.mjs"), {
      workerData: { bytes: copy.buffer }, transferList: [copy.buffer],
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
    });
    let finished = false;
    const finish = (error?: Error, report?: ParsedExam) => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      void worker.terminate().finally(() => { if (error) reject(error); else resolve(report!); });
    };
    const timer = setTimeout(() => finish(new ImportError("TIMEOUT", "PDF işleme süresi aşıldı. Daha küçük, metin içeren bir rapor yükleyin.")), 20_000);
    worker.once("message", (result: { report?: ParsedExam; error?: { code: string; message: string } }) => {
      if (result.error) finish(new ImportError(result.error.code, result.error.message));
      else if (result.report) finish(undefined, result.report);
      else finish(new ImportError("PDF", "PDF işlemi tamamlanamadı."));
    });
    worker.once("error", () => finish(new ImportError("LIMIT", "PDF işlenemedi veya kaynak sınırını aştı.")));
    worker.once("exit", () => { if (!finished) finish(new ImportError("PDF", "PDF işlemi tamamlanamadı.")); });
  });
}
