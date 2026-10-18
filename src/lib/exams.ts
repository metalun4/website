import "server-only";
import { db } from "./storage";
import { requireSession } from "./session";
import { subjects, type Exam } from "@/app/yks27/tyt/data";
import { safePdfUrl } from "./pdf-url";

export type StoredExam = Exam & { id: string };
export async function getExams() {
  await requireSession();
  return db<StoredExam[]>("exams?select=*&order=date.asc,id.asc");
}

export function parseExam(form: FormData): Exam {
  const name = String(form.get("name") ?? "").trim();
  const date = String(form.get("date") ?? "");
  if (!name || name.length > 150 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error("Geçerli bir ad ve tarih girin.");
  function value(key: string, min: number, max: number, integer = false) {
    const raw = String(form.get(key) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(`${key}: geçersiz değer.`);
    return n;
  }
  const rank = value("rank", 1, 10000000, true);
  const participants = value("participants", 1, 10000000, true);
  if (rank !== null && participants !== null && rank > participants) throw new Error("Sıralama katılımcı sayısını aşamaz.");
  const rawPdfUrl = String(form.get("pdf_url") ?? "").trim();
  const pdf_url = safePdfUrl(rawPdfUrl);
  if (rawPdfUrl && !pdf_url) throw new Error("Geçerli bir HTTP veya HTTPS PDF bağlantısı girin (en fazla 2048 karakter).");
  return { name, date, rank, participants, pdf_url, subjects: subjects.map(s => {
    const correct = value(`${s.key}.correct`, 0, s.questions, true);
    const incorrect = value(`${s.key}.incorrect`, 0, s.questions, true);
    if ((correct ?? 0) + (incorrect ?? 0) > s.questions) throw new Error(`${s.label}: soru sayısı aşıldı.`);
    return { correct, incorrect, average: value(`${s.key}.average`, -s.questions / 4, s.questions) };
  }) };
}
