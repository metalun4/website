import { ImportError } from "./types";
import { safePdfUrl } from "../pdf-url";

export function normalizeTopic(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("tr-TR").replace(/\s+/gu, " ").trim();
}
export const truncated = (value: string) => /(?:…|\.{3})\s*$/u.test(value);
export function turkishNumber(value: string): number {
  const clean = value.trim().replace(/\u2212/g, "-");
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(clean)) throw new ImportError("NUMBER", "Raporun bir sayısal hücresi okunamadı.");
  const n = Number(clean.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) throw new ImportError("NUMBER", "Geçersiz sayısal değer.");
  return n;
}
export function turkishDate(value: string): string {
  const m = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) throw new ImportError("DATE", "Sınav tarihi okunamadı.");
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (!Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== iso) throw new ImportError("DATE", "Sınav tarihi geçersiz.");
  return iso;
}
export const solutionUrl = safePdfUrl;
