"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { filterQuestions, questionStatus, statusLabels, type QuestionGroup, type QuestionFilter } from "@/lib/exam-detail";
import { safePdfUrl } from "@/lib/pdf-url";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

function QuestionRow({ subject, question }: { subject: string; question: QuestionGroup["questions"][number] }) {
  const status = questionStatus(question);
  const url = safePdfUrl(question.solution_url);
  return <TableRow id={`soru-${question.subject_id}-${question.question_number}`} data-question={`${question.subject_id}-${question.question_number}`}>
    <TableHead scope="row" data-cell="number" className="font-medium tabular-nums"><span className="md:hidden">Soru </span>{question.question_number}</TableHead>
    <TableCell data-cell="subject">{subject}</TableCell>
    <TableCell data-cell="topic" className="max-w-sm break-words"><Link href={`/yks27/tyt/topics?subject=${encodeURIComponent(question.subject_id)}&q=${encodeURIComponent(question.topic.name)}`} className="hover:text-accent hover:underline">{question.topic.name}</Link>{question.topic.needs_review ? <span className="mt-1 block text-xs text-muted">Konu adı inceleme bekliyor</span> : null}</TableCell>
    <TableCell data-cell="correct" className="text-sm"><span className="text-muted md:hidden">Doğru cevap: </span>{question.correct_answer}</TableCell>
    <TableCell data-cell="selected" className="text-sm"><span className="text-muted md:hidden">Cevabın: </span>{question.selected_answer ?? "—"}</TableCell>
    <TableCell data-cell="status" className={`font-medium ${status === "correct" ? "text-correct" : status === "incorrect" ? "text-incorrect" : ""}`}>{status === "cancelled" ? "İptal · Doğru sayıldı" : statusLabels[status]}</TableCell>
    <TableCell data-cell="solution">{url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${subject} ${question.question_number}. soru: Çözümü aç (yeni sekme)`} className="inline-flex items-center gap-2 text-accent hover:underline">Çözümü aç<ExternalLink size={14} aria-hidden="true" /></a> : <span className="inline-flex min-h-11 items-center text-muted">Bağlantı yok</span>}</TableCell>
  </TableRow>;
}

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
      <FieldGroup><Field className="max-w-sm"><FieldLabel htmlFor="question-subject">Ders seç</FieldLabel>
      <NativeSelect id="question-subject" value={subject} onChange={event => update({ subject: event.target.value })}><NativeSelectOption value="all">Tüm dersler</NativeSelectOption>{groups.map(group => <NativeSelectOption key={group.subject.id} value={group.subject.id}>{group.subject.name} ({group.questions.length})</NativeSelectOption>)}</NativeSelect></Field>
      <Field><FieldLabel id="question-outcome-label">Sonuca göre filtrele</FieldLabel><ToggleGroup type="single" value={filter} aria-labelledby="question-outcome-label" className="max-w-full flex-wrap" onValueChange={value => { if(value) update({ result: value }); }}>{(Object.keys(statusLabels) as QuestionFilter[]).map(value => <ToggleGroupItem key={value} value={value} aria-controls="question-results">{statusLabels[value]}</ToggleGroupItem>)}</ToggleGroup></Field></FieldGroup>
      {(subject !== "all" || filter !== "all") && <Button type="button" variant="link" onClick={() => update({ subject: null, result: null })} className="mt-3">Tüm filtreleri temizle</Button>}
    </div>
    <p role="status" aria-live="polite" aria-atomic="true" className="my-4 text-muted">{count} / {total} soru gösteriliyor · {statusLabels[filter]}</p>
    <section className="mb-4" aria-labelledby="subject-jump-heading"><h3 id="subject-jump-heading" className="text-sm font-medium">Derse atla</h3><nav aria-label="Soru analizinde derslere git" className="yks-jump-links my-3">{visible.map(group => <a key={group.subject.id} href={`#questions-${group.subject.id}`}>{group.subject.name} ({group.filtered.length})</a>)}</nav></section>
    <p className="mb-4 text-xs leading-6 text-muted">DC: Doğru cevap · ÖC: Öğrenci cevabı. İptal sorular doğru sayılmıştır. Konu adları kayıtlı biçimleriyle gösterilir.</p>
    <div id="question-results" className="flex flex-col gap-3">{visible.map(group => <details key={`${group.subject.id}:${filter}`} open={subject !== "all" || filter !== "all"} id={`questions-${group.subject.id}`} className="scroll-mt-6 rounded-xl border border-border bg-surface">
      <summary className="min-h-11 px-4 py-4"><h3 className="inline font-semibold">{group.subject.name} <span className="font-normal text-muted">· {group.filtered.length} / {group.questions.length} soru</span></h3></summary>
      {!group.filtered.length ? <p className="p-4 text-muted">Bu filtreye uygun soru yok.</p> : <div role="region" aria-label={`${group.subject.name} konu analizi`} tabIndex={0} className="overflow-x-auto rounded-b-xl border-t border-border">
        <Table className="yks-question-table"><TableCaption className="sr-only">{group.subject.name} soru ve konu analizi</TableCaption>
          <colgroup>{[6, 18, 30, 7, 7, 16, 16].map((width, i) => <col key={i} style={{ width: `${width}%` }} />)}</colgroup>
          <TableHeader><TableRow>{["No", "Ders", "Konu", "DC", "ÖC", "Sonuç", "Çözüm"].map(label => <TableHead key={label} scope="col">{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{group.filtered.map(question => <QuestionRow key={question.id} subject={group.subject.name} question={question} />)}</TableBody>
        </Table>
      </div>}
    </details>)}</div>
  </section>;
}
