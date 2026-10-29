"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, readSession, hash } from "@/lib/session";
import { db } from "@/lib/storage";
import { prepareReport } from "@/lib/exam-import/prepare";
import { persistImport, previewImport, reportPayload } from "@/lib/exam-import/persist";
import { sha256, signReceipt, readReceipt, verifyReceipt } from "@/lib/exam-import/receipt";
import { resolveTopic } from "@/lib/exam-import/topics";
import { ImportError, SUBJECTS, type Preview, type Topic } from "@/lib/exam-import/types";

export type ImportState = { error?: string; success?: string; preview?: Preview; reviewTopics?: Topic[]; unassignedTopics?: Topic[] };
export async function importPdf(form: FormData): Promise<ImportState> {
  const admin = await requireAdmin();
  try {
    const allowed = await db<boolean>("rpc/consume_login_attempt", { method: "POST", body: JSON.stringify({ bucket: hash(`pdf-import:${admin.token_hash}`), max_attempts: 30 }) });
    if (!allowed) return { error: "Çok fazla PDF isteği. 15 dakika sonra yeniden deneyin." };
    const file = form.get("pdf");
    if (!(file instanceof File) || !/\.pdf$/i.test(file.name) || !["", "application/pdf"].includes(file.type)) return { error: "Bir PDF dosyası seçin." };
    if (!file.size || file.size > 2 * 1024 * 1024) return { error: "PDF en fazla 2 MiB olabilir." };
    const mode = form.get("mode");
    if (mode !== "preview" && mode !== "confirm") return { error: "Önce raporu önizleyin." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileHash = sha256(bytes);
    const secret = process.env.SESSION_SECRET!;
    // Reject stale/tampered confirmation attempts before spawning a PDF worker.
    if (mode === "confirm") readReceipt(String(form.get("receipt") ?? ""), fileHash, admin.token_hash, secret);
    const parsed = await prepareReport(bytes);
    const reportHash = sha256(JSON.stringify(reportPayload(parsed)));
    if (mode === "confirm") {
      verifyReceipt(String(form.get("receipt") ?? ""), fileHash, reportHash, admin.token_hash, secret);
      // Recheck authorization after extraction; the database checks expiry again.
      const current = await readSession();
      if (current?.role !== "admin") return { error: "Oturumunuz sona erdi. Yeniden giriş yapıp PDF’yi önizleyin." };
      const result = await persistImport(parsed, current.token_hash);
      if (result.status === "collision") return { error: "Bu rapor mevcut bir sınavla çakışıyor. Kayıtların tarihini ve sonuçlarını karşılaştırın; hiçbir kayıt değiştirilmedi." };
      for (const path of ["/yks27/admin", "/yks27/admin/topics", "/yks27/tyt", "/yks27/tyt/dashboard", "/yks27/tyt/topics"]) revalidatePath(path);
      const unassigned = result.unassigned_topics?.length ? ` ${result.unassigned_topics.length} konu grubu bekliyor.` : "";
      return { success: result.status === "duplicate" ? "Bu rapor zaten kayıtlı. İkinci bir kayıt oluşturulmadı." : `Deneme içe aktarıldı: 120 soru, 13 ders sonucu ve 4 sıralama kaydedildi.${unassigned}`, reviewTopics: result.review_topics, unassignedTopics: result.unassigned_topics ?? [] };
    }
    const existing = await previewImport(parsed);
    const reviewTopics = [...new Set(parsed.questions.flatMap(q => {
      const resolved = resolveTopic(q.subject_id, q.topic_label, existing.topics);
      return resolved.existing?.needs_review || resolved.create?.needs_review ? [`${SUBJECTS.find(s => s.id === q.subject_id)?.name}: ${q.topic_label}`] : [];
    }))];
    const unassignedLabels = [...new Set((existing.unassigned_labels ?? []).map(label => `${SUBJECTS.find(s => s.id === label.subject_id)?.name ?? label.subject_id}: ${label.topic_label}`))];
    return { preview: { exam: parsed.exam, subjects: parsed.subjects, rankings: parsed.rankings, warnings: parsed.warnings, questionCount: parsed.questions.length, linkCount: parsed.questions.filter(q => q.solution_url).length, reviewTopics, unassignedLabels, receipt: signReceipt(fileHash, reportHash, admin.token_hash, secret), duplicate: existing.status === "duplicate", collision: existing.status === "collision" } };
  } catch (error) {
    if (error instanceof ImportError) return { error: error.message };
    // Neither raw database errors nor PDF contents/PII are logged or returned.
    return { error: "İçe aktarma tamamlanamadı. Veritabanı kurulumunu ve bağlantısını kontrol edip yeniden deneyin." };
  }
}
