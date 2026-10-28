import { repairGlyphs } from "./glyphs";
import { solutionUrl } from "./normalize";
import { ImportError, type ExtractedPdf } from "./types";

export const MAX_PDF_BYTES = 2 * 1024 * 1024;
export async function extractPdf(bytes: Uint8Array): Promise<ExtractedPdf> {
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) throw new ImportError("SIZE", "PDF en fazla 2 MiB olabilir.");
  if (!Buffer.from(bytes.subarray(0, 1024)).includes(Buffer.from("%PDF-"))) throw new ImportError("FILE", "Geçerli bir PDF dosyası seçin.");
  try {
    const fixed = await repairGlyphs(bytes);
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: new Uint8Array(fixed.bytes), useSystemFonts: false, disableFontFace: true, stopAtErrors: true, verbosity: 0 });
    let expired = false;
    const timer = setTimeout(() => { expired = true; void task.destroy(); }, 15_000);
    try {
      const doc = await task.promise;
      if (doc.numPages !== 2) throw new ImportError("FORMAT", "İki sayfalık bireysel TYT raporu gerekli.");
      const pages: ExtractedPdf["pages"] = [];
      for (let n = 1; n <= 2; n++) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const annotations = await page.getAnnotations();
        if (content.items.length > 20_000 || annotations.length > 250) throw new ImportError("LIMIT", "PDF içerik sınırı aşıldı.");
        const text = content.items.flatMap(item => {
          if (!("str" in item) || !item.str.trim()) return [];
          const [x, baseline] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          const height = Math.abs(item.height);
          return [{ text: item.str, x, y: baseline - height, width: item.width, height }];
        });
        if (text.length < 30) throw new ImportError("SCANNED", "PDF okunabilir metin içermiyor. OCR desteklenmiyor; metin içeren karneyi yükleyin.");
        const links = annotations.flatMap(a => {
          if (a.subtype !== "Link" || !a.url || !Array.isArray(a.rect)) return [];
          const url = solutionUrl(a.url);
          if (!url) throw new ImportError("LINK", "PDF güvenli olmayan bir çözüm bağlantısı içeriyor.");
          const r = [...viewport.convertToViewportPoint(a.rect[0], a.rect[1]), ...viewport.convertToViewportPoint(a.rect[2], a.rect[3])];
          return [{ x: Math.min(r[0], r[2]), y: Math.min(r[1], r[3]), width: Math.abs(r[2] - r[0]), height: Math.abs(r[3] - r[1]), url }];
        });
        pages.push({ width: viewport.width, height: viewport.height, text, links });
        page.cleanup();
      }
      if (expired) throw new ImportError("TIMEOUT", "PDF işleme süresi aşıldı.");
      return { pages, repairedGlyphs: fixed.repaired };
    } finally { clearTimeout(timer); await task.destroy(); }
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError("PDF", "PDF açılamadı. Dosya bozuk, şifreli veya desteklenmeyen biçimde olabilir.");
  }
}
