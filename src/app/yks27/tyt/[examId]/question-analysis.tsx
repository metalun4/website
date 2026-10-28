"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { filterQuestions, questionStatus, statusLabels, type DetailSubject, type DetailQuestion, type QuestionFilter } from "@/lib/exam-detail";
import { safePdfUrl } from "@/lib/pdf-url";

type Group = { subject: DetailSubject; questions: DetailQuestion[] };

export function QuestionAnalysis({ groups }: { groups: Group[] }) {
  const [filter, setFilter] = useState<QuestionFilter>("all");
  const visible = groups.map(group => ({ ...group, filtered: filterQuestions(group.questions, filter) }));
  const total = groups.reduce((sum, group) => sum + group.questions.length, 0);
  const count = visible.reduce((sum, group) => sum + group.filtered.length, 0);
  return <section id="konu-analizi" aria-labelledby="question-heading" className="scroll-mt-6">
    <h2 id="question-heading" className="text-xl font-semibold">Konu Analizi</h2>
    <p className="mt-2 leading-6 text-muted">DC: Doğru cevap · ÖC: Öğrenci cevabı. İptal sorular doğru sayılmıştır. Konu adları kayıtlı biçimleriyle gösterilir.</p>
    <nav aria-label="Soru analizinde derslere git" className="yks-jump-links mt-5">{groups.map(group => <a key={group.subject.id} href={`#questions-${group.subject.id}`}>{group.subject.name} ({group.questions.length})</a>)}</nav>
    <fieldset className="mt-6"><legend className="mb-3 font-medium">Sonuca göre filtrele</legend><div className="flex flex-wrap gap-2">{(Object.keys(statusLabels) as QuestionFilter[]).map(value => <button type="button" key={value} aria-pressed={filter === value} aria-controls="question-results" onClick={() => setFilter(value)} className={`rounded-lg border px-4 py-2 ${filter === value ? "border-accent bg-accent-soft font-medium text-accent" : "border-border bg-surface hover:bg-surface-muted"}`}>{statusLabels[value]}</button>)}</div></fieldset>
    <p role="status" aria-live="polite" aria-atomic="true" className="my-4 text-muted">{count} / {total} soru gösteriliyor · {statusLabels[filter]}</p>
    <p className="mb-4 text-xs text-muted sm:hidden">Tüm sütunları görmek için tabloları yana kaydır.</p>
    <div id="question-results" className="space-y-6">{visible.map(group => <section key={group.subject.id} id={`questions-${group.subject.id}`} aria-labelledby={`heading-${group.subject.id}`} className="scroll-mt-6 overflow-hidden rounded-xl border border-border bg-surface">
      <h3 id={`heading-${group.subject.id}`} tabIndex={-1} className="border-b border-border px-4 py-4 font-semibold">{group.subject.name} <span className="font-normal text-muted">· {group.filtered.length} / {group.questions.length} soru</span></h3>
      {!group.filtered.length ? <p className="p-4 text-muted">Bu filtreye uygun soru yok.</p> : <div role="region" aria-label={`${group.subject.name} konu analizi`} tabIndex={0} className="overflow-x-auto">
        <table className="w-full min-w-[740px] text-left"><caption className="sr-only">{group.subject.name} soru ve konu analizi</caption>
          <thead className="bg-surface-muted text-xs text-muted"><tr>{["No", "Ders", "Konu", "DC", "ÖC", "Sonuç", "Çözüm"].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">{group.filtered.map(question => {
            const status = questionStatus(question);
            const url = safePdfUrl(question.solution_url);
            return <tr key={question.id} data-question={`${question.subject_id}-${question.question_number}`}>
              <th scope="row" className="px-4 py-3 font-medium tabular-nums">{question.question_number}</th><td className="px-4 py-3">{group.subject.name}</td>
              <td className="min-w-48 max-w-sm px-4 py-3 break-words">{question.topic.name}{question.topic.needs_review && <span className="mt-1 block text-xs text-muted">Konu adı inceleme bekliyor</span>}</td>
              <td className="px-4 py-3">{question.correct_answer}</td><td className="px-4 py-3">{question.selected_answer ?? "—"}</td>
              <td className={`px-4 py-3 font-medium ${status === "correct" ? "text-green-700 dark:text-green-400" : status === "incorrect" ? "text-red-700 dark:text-red-400" : ""}`}>{status === "cancelled" ? "İptal · Doğru sayıldı" : statusLabels[status]}</td>
              <td className="px-4 py-3">{url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${group.subject.name} ${question.question_number}. soru: Çözümü Aç (yeni sekme)`} className="inline-flex items-center gap-2 whitespace-nowrap text-accent hover:underline">Çözümü Aç<ExternalLink size={14} aria-hidden="true" /></a> : <span className="text-muted">Bağlantı yok</span>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </section>)}</div>
  </section>;
}
