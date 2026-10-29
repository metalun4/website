"use client";

import { useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { filterQuestions, questionStatus, statusLabels, type QuestionGroup, type QuestionFilter } from "@/lib/exam-detail";
import { safePdfUrl } from "@/lib/pdf-url";

export function QuestionAnalysis({ groups }: { groups: QuestionGroup[] }) {
  const search = useSearchParams();
  const rawFilter = search?.get("result") ?? "all";
  const filter: QuestionFilter = Object.hasOwn(statusLabels, rawFilter) ? rawFilter as QuestionFilter : "all";
  const subject = groups.some(group => group.subject.id === search?.get("subject")) ? search!.get("subject")! : "all";
  function update(values: Record<string, string | null>) {
    const next = new URLSearchParams(search?.toString());
    next.delete("topic");
    for (const [key, value] of Object.entries(values)) {
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
    }
    window.history.replaceState(null, "", `${window.location.pathname}${next.size ? "?" + next : ""}#konu-analizi`);
  }
  const selectedGroups = subject === "all" ? groups : groups.filter(group => group.subject.id === subject);
  const visible = selectedGroups.map(group => ({ ...group, filtered: filterQuestions(group.questions, filter) }));
  const total = groups.reduce((sum, group) => sum + group.questions.length, 0);
  const count = visible.reduce((sum, group) => sum + group.filtered.length, 0);
  return <section id="konu-analizi" aria-labelledby="question-heading" className="scroll-mt-6">
    <h2 id="question-heading" className="text-xl font-semibold">Konu analizi</h2>
    <p className="mt-2 leading-6 text-muted">Soruları ders ve sonuç durumuna göre incele; ilgili sorunun çözümüne geç.</p>
    <div className="my-5 rounded-xl border border-border bg-surface p-4">
      <label htmlFor="question-subject" className="mb-2 block font-medium">Ders seç</label>
      <select id="question-subject" className="yks-input max-w-sm" value={subject} onChange={event => update({ subject: event.target.value })}><option value="all">Tüm dersler</option>{groups.map(group => <option key={group.subject.id} value={group.subject.id}>{group.subject.name} ({group.questions.length})</option>)}</select>
      <fieldset className="mt-4"><legend className="mb-2 font-medium">Sonuca göre filtrele</legend><div className="flex flex-wrap gap-2">{(Object.keys(statusLabels) as QuestionFilter[]).map(value => <button type="button" key={value} aria-pressed={filter === value} aria-controls="question-results" onClick={() => update({ result: value })} className={`rounded-lg border px-3 py-2 text-sm ${filter === value ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border hover:bg-surface-muted"}`}>{statusLabels[value]}</button>)}</div></fieldset>
      {(subject !== "all" || filter !== "all") && <button type="button" onClick={() => update({ subject: null, result: null })} className="mt-3 text-accent hover:underline">Tüm filtreleri temizle</button>}
    </div>
    <p role="status" aria-live="polite" aria-atomic="true" className="my-4 text-muted">{count} / {total} soru gösteriliyor · {statusLabels[filter]}</p>
    <section className="mb-4" aria-labelledby="subject-jump-heading"><h3 id="subject-jump-heading" className="text-sm font-medium">Derse atla</h3><nav aria-label="Soru analizinde derslere git" className="yks-jump-links my-3">{visible.map(group => <a key={group.subject.id} href={`#questions-${group.subject.id}`}>{group.subject.name} ({group.filtered.length})</a>)}</nav></section>
    <p className="mb-4 text-xs leading-6 text-muted">DC: Doğru cevap · ÖC: Öğrenci cevabı. İptal sorular doğru sayılmıştır. Konu adları kayıtlı biçimleriyle gösterilir.</p>
    <div id="question-results" className="space-y-3">{visible.map(group => <details key={`${group.subject.id}:${filter}`} open={subject !== "all" || filter !== "all"} id={`questions-${group.subject.id}`} className="scroll-mt-6 rounded-xl border border-border bg-surface">
      <summary className="min-h-11 px-4 py-4"><h3 className="inline font-semibold">{group.subject.name} <span className="font-normal text-muted">· {group.filtered.length} / {group.questions.length} soru</span></h3></summary>
      {!group.filtered.length ? <p className="p-4 text-muted">Bu filtreye uygun soru yok.</p> : <div role="region" aria-label={`${group.subject.name} konu analizi`} tabIndex={0} className="overflow-x-auto rounded-b-xl border-t border-border">
        <table className="yks-question-table"><caption className="sr-only">{group.subject.name} soru ve konu analizi</caption>
          <colgroup>{[6, 18, 30, 7, 7, 16, 16].map((width, i) => <col key={i} style={{ width: `${width}%` }} />)}</colgroup>
          <thead><tr>{["No", "Ders", "Konu", "DC", "ÖC", "Sonuç", "Çözüm"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{group.filtered.map(question => {
            const status = questionStatus(question);
            const url = safePdfUrl(question.solution_url);
            return <tr key={question.id} data-question={`${question.subject_id}-${question.question_number}`}>
              <th scope="row" className="font-medium tabular-nums"><span className="md:hidden">Soru </span>{question.question_number}</th><td data-cell="subject">{group.subject.name}</td>
              <td data-cell="topic" className="break-words">{question.topic.name}{question.topic.needs_review && <span className="mt-1 block text-xs text-muted">Konu adı inceleme bekliyor</span>}</td>
              <td className="text-sm"><span className="text-muted md:hidden">Doğru cevap: </span>{question.correct_answer}</td><td className="text-sm"><span className="text-muted md:hidden">Cevabın: </span>{question.selected_answer ?? "—"}</td>
              <td data-cell="status" className={`font-medium ${status === "correct" ? "text-green-700 dark:text-green-400" : status === "incorrect" ? "text-red-700 dark:text-red-400" : ""}`}>{status === "cancelled" ? "İptal · Doğru sayıldı" : statusLabels[status]}</td>
              <td data-cell="solution">{url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${group.subject.name} ${question.question_number}. soru: Çözümü aç (yeni sekme)`} className="inline-flex items-center gap-2 text-accent hover:underline">Çözümü aç<ExternalLink size={14} aria-hidden="true" /></a> : <span className="inline-flex min-h-11 items-center text-muted">Bağlantı yok</span>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </details>)}</div>
  </section>;
}
