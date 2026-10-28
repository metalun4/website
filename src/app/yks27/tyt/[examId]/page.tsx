import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getTytExamDetail } from "@/lib/exams";
import { groupQuestions, groupResults, rankingLabels } from "@/lib/exam-detail";
import { AccountBar } from "../account-bar";
import { dateLabel, number } from "../data";
import { QuestionAnalysis } from "./question-analysis";

export const metadata: Metadata = { title: "TYT Deneme Detayı | YKS 2027", description: "TYT denemesinin ders sonuçları, sıralamaları ve soru bazında konu analizi.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const cell = "px-4 py-3 text-right tabular-nums";

export default async function ExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const current = await requireSession();
  const { examId } = await params;
  const exam = await getTytExamDetail(examId);
  if (!exam) notFound();
  const metrics = [
    ["Puan", number(exam.score)], ["Toplam net", number(exam.total_net)], ["Ortalama net", number(exam.average_net)],
    ["Soru", number(exam.total_questions, 0)], ["Doğru", number(exam.total_correct, 0)], ["Yanlış", number(exam.total_wrong, 0)], ["Boş", number(exam.total_blank, 0)],
  ];
  return <main className="min-h-screen bg-background px-3 py-6 text-sm text-foreground sm:px-5 sm:py-10" lang="tr">
    <div className="mx-auto max-w-7xl">
      <AccountBar admin={current.role === "admin"} />
      <header className="mb-8">
        <Link href="/yks27/tyt" className="inline-flex items-center text-muted hover:underline">← TYT denemeleri</Link>
        <p className="mt-5 flex items-center gap-2 text-xs tracking-wider text-muted"><BookOpen size={17} aria-hidden="true" /> TYT · DENEME RAPORU</p>
        <h1 id="yks-content" tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight">{exam.name}</h1>
        <p className="mt-3 text-muted"><time dateTime={exam.exam_date}>{dateLabel(exam.exam_date)}</time></p>
        {(exam.institution_name || exam.class_label) && <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-muted">
          {exam.institution_name && <div><dt className="inline">Kurum: </dt><dd className="inline">{exam.institution_name}</dd></div>}
          {exam.class_label && <div><dt className="inline">Sınıf: </dt><dd className="inline">{exam.class_label}</dd></div>}
        </dl>}
      </header>
      <dl aria-label="Deneme özeti" className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{metrics.map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface p-4"><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 text-xl font-semibold tabular-nums">{value}</dd></div>)}</dl>
      <nav aria-label="Rapor bölümleri" className="yks-jump-links mb-8"><a href="#ders-analizi">Ders analizi</a><a href="#siralamalar">Sıralamalar</a><a href="#konu-analizi">Konu analizi</a></nav>
      <section id="ders-analizi" aria-labelledby="ders-heading" className="mb-10 scroll-mt-6">
        <h2 id="ders-heading" className="text-xl font-semibold">Ders Analizi</h2>
        <p className="mt-2 text-muted">Toplam satırları alt dersleri kapsar. Ortalamalar raporda bildirilen değerlerdir.</p>
        <div className="mt-5 space-y-5">{groupResults(exam.exam_subject_results).map(group => <div key={group.id} className="overflow-hidden rounded-xl border border-border bg-surface">
          <h3 className="border-b border-border px-4 py-4 font-semibold">{group.name}</h3>
          <div className="overflow-x-auto" role="region" aria-label={`${group.name} ders sonuçları`} tabIndex={0}>
            <table className="w-full min-w-[760px] table-fixed"><caption className="sr-only">{group.name} ayrıntılı ders sonuçları</caption>
              <colgroup><col className="w-[28%]" /><col span={6} className="w-[12%]" /></colgroup>
              <thead className="bg-surface-muted text-xs text-muted"><tr><th scope="col" className="px-4 py-3 text-left">Ders</th>{["Soru", "Doğru", "Yanlış", "Boş", "Net", "Ortalama"].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">{group.rows.map(row => <tr key={`${row.subject_id}-${row.result_scope}`} data-result={`${row.subject_id}-${row.result_scope}`} className={row.result_scope === "aggregate" ? "bg-surface-emphasis font-semibold" : undefined}>
                <th scope="row" className="px-4 py-3 text-left font-medium break-words">{row.subject.name}{row.result_scope === "aggregate" ? " · Toplam" : ""}</th>
                {[row.question_count, row.correct_count, row.wrong_count, row.blank_count, row.net, row.average_net].map((value, i) => <td key={i} className={`${cell} ${i === 4 ? "font-semibold text-accent" : ""}`}>{number(value, i < 4 ? 0 : 2)}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </div>)}</div>
      </section>
      <section id="siralamalar" aria-labelledby="ranking-heading" className="mb-10 scroll-mt-6">
        <h2 id="ranking-heading" className="text-xl font-semibold">Sıralamalar</h2>
        <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(rankingLabels).map(([scope, label]) => {
          const ranking = exam.exam_rankings.find(row => row.scope === scope);
          return <div key={scope} className="rounded-xl border border-border bg-surface p-5"><dt className="text-muted">{label}</dt><dd className="mt-2 font-semibold tabular-nums">{ranking ? <>{number(ranking.rank, 0)}. <span className="font-normal text-muted">/ {number(ranking.participant_count, 0)} kişi</span></> : "Veri yok"}</dd></div>;
        })}</dl>
      </section>
      <QuestionAnalysis groups={groupQuestions(exam.exam_subject_results, exam.exam_questions)} />
    </div>
  </main>;
}
