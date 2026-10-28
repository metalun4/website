"use client";

import { useActionState, useState, type DragEvent } from "react";
import Link from "next/link";
import { importPdf, type ImportState } from "./import-actions";
import { SUBJECTS } from "@/lib/exam-import/types";
import { dateLabel, number } from "../tyt/data";

const button = "min-h-11 rounded-lg border border-border bg-surface-emphasis px-4 py-2.5 font-medium hover:bg-surface-muted disabled:opacity-50";
const scopeNames = { general: "Genel", institution: "Kurum", branch: "Şube", class: "Sınıf" };
export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const choose = (next: File | undefined) => {
    if (busy) return;
    setSelectionError(""); setFile(next ?? null); setVersion(v => v + 1);
  };
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (busy) return;
    if (event.dataTransfer.files.length === 1) choose(event.dataTransfer.files[0]);
    else setSelectionError("Her seferinde tek bir PDF seçin.");
  }
  return <div><div onDragOver={e => e.preventDefault()} onDrop={drop} className="rounded-xl border border-dashed border-border bg-background p-5">
    <label className="block font-medium" htmlFor="exam-pdf">TYT karnesi (PDF, en fazla 2 MiB)</label>
    <p className="my-2 text-muted">İki sayfalık bireysel karneyi buraya bırakın veya dosya seçin.</p>
    <input id="exam-pdf" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e => choose(e.target.files?.[0])} className="block max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-border file:bg-surface file:px-4 file:text-foreground focus-visible:outline-2 focus-visible:outline-accent" />
    {selectionError && <p role="alert" className="mt-2 text-red-600 dark:text-red-400">{selectionError}</p>}
  </div><ImportReview key={version} file={file} onBusy={setBusy} /></div>;
}
function ImportReview({ file, onBusy }: { file: File | null; onBusy: (busy: boolean) => void }) {
  const [state, action, pending] = useActionState(async (previous: ImportState, form: FormData) => {
    if (file) form.set("pdf", file);
    onBusy(true);
    try { return await importPdf(form); }
    catch { return { error: "İstek tamamlanamadı. Sayfayı yenileyip yeniden önizleyin." }; }
    finally { onBusy(false); }
  }, {});
  const preview = state.preview;
  return <form action={action} className="mt-5 space-y-5" aria-busy={pending}>
    {file && <p className="break-all text-muted">Seçilen dosya: {file.name}</p>}
    <div aria-live="polite">{state.error && <p role="alert" className="text-red-600 dark:text-red-400">{state.error}</p>}{state.success && <p role="status">{state.success} <Link href="/yks27/tyt" className="underline">Denemeleri görüntüle</Link></p>}{pending && <p role="status">{preview ? "Rapor doğrulanıyor ve kaydediliyor…" : "PDF okunuyor ve doğrulanıyor…"}</p>}</div>
    {!state.success && <button name="mode" value="preview" disabled={!file || pending} className={button}>{preview ? "Yeniden önizle" : "PDF’yi önizle"}</button>}
    {preview && <section aria-label="İçe aktarma önizlemesi" className="space-y-4 rounded-xl border border-border p-4">
      <h3 className="break-words text-lg font-semibold">{preview.exam.name}</h3>
      <p>{dateLabel(preview.exam.exam_date)} · {preview.exam.institution_name} · {preview.exam.class_label}</p>
      <p>Puan: {number(preview.exam.score)} · Net: {number(preview.exam.total_net)} · Rapor ortalaması: {number(preview.exam.average_net)}</p>
      <p>{preview.exam.total_correct} doğru · {preview.exam.total_wrong} yanlış · {preview.exam.total_blank} boş</p>
      <p>{preview.questionCount} soru · {preview.subjects.length} ders sonucu · {preview.rankings.length} sıralama · {preview.linkCount} çözüm bağlantısı</p>
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs sm:text-sm"><caption className="sr-only">Raporun ders sonuçları</caption><thead><tr>{["Ders", "Kapsam", "Soru", "D", "Y", "B", "Net", "Ort."].map(x => <th key={x} scope="col" className="px-2 py-2">{x}</th>)}</tr></thead><tbody>{preview.subjects.map(r => <tr key={`${r.subject_id}:${r.result_scope}`} className="border-t border-border"><th scope="row" className="px-2 py-2 font-medium">{SUBJECTS.find(s => s.id === r.subject_id)?.name}</th><td className="px-2">{r.result_scope === "direct" ? "Doğrudan" : "Toplam"}</td>{[r.question_count, r.correct_count, r.wrong_count, r.blank_count].map((n, i) => <td key={i} className="px-2 tabular-nums">{n}</td>)}<td className="px-2 tabular-nums">{number(r.net)}</td><td className="px-2 tabular-nums">{number(r.average_net)}</td></tr>)}</tbody></table></div>
      <ul>{preview.rankings.map(r => <li key={r.scope}>{scopeNames[r.scope]}: {number(r.rank, 0)} / {number(r.participant_count, 0)}</li>)}</ul>
      {preview.warnings.map(w => <p key={w} className="text-muted">{w}</p>)}
      <ReviewLabels labels={preview.reviewTopics} />
      {preview.duplicate && <p role="status">Bu rapor zaten kayıtlı. Onaylandığında mevcut kayıt korunur.</p>}
      {preview.collision && <p role="alert" className="text-red-600 dark:text-red-400">Mevcut bir sınavla olası çakışma bulundu. Tarihi ve sonuçları karşılaştırın; çakışma giderilmeden içe aktarılamaz.</p>}
      <input type="hidden" name="receipt" value={preview.receipt} />
      <button name="mode" value="confirm" disabled={pending || preview.collision} className={button}>{preview.duplicate ? "Mevcut kaydı doğrula" : "Onayla ve içe aktar"}</button>
    </section>}
    {state.reviewTopics && <ReviewLabels labels={state.reviewTopics.map(t => `${SUBJECTS.find(s => s.id === t.subject_id)?.name ?? t.subject_id}: ${t.name}`)} />}
  </form>;
}
function ReviewLabels({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return <details className="rounded-lg border border-border p-3"><summary className="min-h-6 cursor-pointer font-medium">İnceleme gerektiren konular ({labels.length})</summary><p className="my-2 text-muted">Kesilmiş etiketler genişletilmeden, geçici konu olarak saklanır.</p><ul className="list-inside list-disc space-y-1">{labels.map(label => <li key={label} className="break-words">{label}</li>)}</ul></details>;
}
