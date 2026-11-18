import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table";
import { SummaryStrip, ReportBreadcrumb } from "../../workspace-ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getTytExamDetail } from "@/lib/exams";
import { loadStudyAnalysis } from "@/lib/topic-study";
import { groupQuestions, groupResults, rankingLabels } from "@/lib/exam-detail";
import { queryValue, type Query } from "@/lib/yks-navigation";
import { dateLabel, formatPercent, number } from "../data";
import { QuestionAnalysis } from "./question-analysis";
import { StudyAnalysisSection } from "./study-analysis";

export const metadata: Metadata = { title: "TYT Deneme Detayı | YKS 2027", description: "TYT denemesinin ders sonuçları, sıralamaları ve soru bazında konu analizi.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ExamPage({ params, searchParams }: { params: Promise<{ examId: string }>; searchParams: Promise<Query> }) {
  const [{ examId }, query] = await Promise.all([params, searchParams]);
  const search = new URLSearchParams();
  for (const key of ["result", "subject"]) if (queryValue(query[key])) search.set(key, queryValue(query[key]));
  await requireSession(`/yks27/tyt/${examId}${search.size ? "?" + search : ""}`);
  const [exam, studyAnalysis] = await Promise.all([
    getTytExamDetail(examId),
    loadStudyAnalysis(examId, true).catch(() => null),
  ]);
  if (!exam) notFound();
  return <main className="yks-page"><div className="mx-auto max-w-7xl">
    <header className="mb-5">
      <ReportBreadcrumb current="Deneme raporu" />
      <h1 id="yks-content" tabIndex={-1} className="text-2xl font-semibold tracking-tight sm:text-3xl">{exam.name}</h1>
      <p className="mt-2 text-sm text-muted"><time dateTime={exam.exam_date}>{dateLabel(exam.exam_date)}</time>{exam.institution_name && <> · {exam.institution_name}</>}{exam.class_label && <> · {exam.class_label}</>}</p>
    </header>
    <SummaryStrip label="Deneme özeti" className="yks-report-summary" items={[["Toplam net", number(exam.total_net)], ["Puan", number(exam.score)], ["Ortalama net", number(exam.average_net)]].map(([label,value],i) => ({ label, value, lead: i === 0 }))} />
    <SummaryStrip label="Yanıt dağılımı" items={[["Soru",exam.total_questions],["Doğru",exam.total_correct],["Yanlış",exam.total_wrong],["Boş",exam.total_blank]].map(([label,value]) => ({ label: String(label), value: number(value as number,0), tone: label === "Doğru" ? "correct" : label === "Yanlış" ? "incorrect" : undefined }))} />
    <nav aria-label="Rapor bölümleri" className="yks-jump-links mb-6"><a href="#ders-analizi">Ders sonuçları</a><a href="#siralamalar">Sıralamalar</a><a href="#islenen-konularda-kacirilanlar">İşlediğim konularda kaçırdıklarım</a><a href="#konu-analizi">Bu denemenin soruları</a><Link href="/yks27/tyt/topics">Denemeler arası konu başarısı</Link></nav>
    <section id="ders-analizi" aria-labelledby="ders-heading" className="mt-9 scroll-mt-6">
      <h2 id="ders-heading" className="text-xl font-semibold">Ders sonuçları</h2><p className="mt-2 mb-4 text-sm leading-6 text-muted">Doğru, yanlış ve boş sayılarını ders bazında incele. Toplam satırları alt dersleri kapsar.</p>
      <div className="flex flex-col gap-3">{groupResults(exam.exam_subject_results).map(group => {
        const total = group.rows.find(row => row.result_scope === "aggregate") ?? group.rows.find(row => row.subject_id === group.id);
        return <section key={group.id} className="rounded-xl border border-border bg-surface">
          <header className="yks-band"><h3 className="min-w-0 font-semibold">{group.name}</h3><span className="shrink-0 font-semibold text-accent tabular-nums">{number(total?.net ?? null)} net</span></header>
          <dl className="divide-y divide-border border-t border-border md:hidden">{group.rows.map(row => <div key={`${row.subject_id}-${row.result_scope}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-start gap-3 p-4"><dt className="min-w-0 break-words font-medium">{row.subject.name}{row.result_scope === "aggregate" ? " · Toplam" : ""}</dt><dd className="min-w-0 text-right tabular-nums"><strong className="text-accent tabular-nums">{number(row.net)} net</strong><span className="mt-1 block text-xs text-muted">{row.correct_count} doğru · {row.wrong_count} yanlış · {row.blank_count} boş</span><span className="mt-1 block text-xs text-muted">{row.question_count} soru · Ortalama {number(row.average_net)}</span></dd></div>)}</dl>
          <div className="hidden overflow-x-auto rounded-b-xl border-t border-border md:block" role="region" aria-label={`${group.name} ders sonuçları`} tabIndex={0}>
            <Table className="yks-results-table yks-detail-results"><TableCaption className="sr-only">{group.name} ayrıntılı ders sonuçları</TableCaption>
              <colgroup><col />{Array.from({ length: 6 }, (_, i) => <col key={i} />)}</colgroup>
              <TableHeader><TableRow><TableHead scope="col">Ders</TableHead>{["Soru", "Doğru", "Yanlış", "Boş", "Net", "Ortalama"].map(label => <TableHead key={label} scope="col">{label}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{group.rows.map(row => <TableRow key={`${row.subject_id}-${row.result_scope}`} data-result={`${row.subject_id}-${row.result_scope}`} className={row.result_scope === "aggregate" ? "bg-surface-emphasis font-semibold" : undefined}><TableHead scope="row" className="break-words">{row.subject.name}{row.result_scope === "aggregate" ? " · Toplam" : ""}</TableHead>{[row.question_count, row.correct_count, row.wrong_count, row.blank_count, row.net, row.average_net].map((value, i) => <TableCell key={i} className={i === 4 ? "font-semibold text-accent" : undefined}>{number(value, i < 4 ? 0 : 2)}</TableCell>)}</TableRow>)}</TableBody>
            </Table>
          </div>
        </section>;
      })}</div>
    </section>
    <section id="siralamalar" aria-labelledby="rankings-heading" className="mt-8 scroll-mt-6 rounded-xl border border-border bg-surface"><h2 id="rankings-heading" className="px-4 pt-4 text-lg font-semibold">Sıralamalar</h2><p className="px-4 pt-2 pb-4 text-xs leading-6 text-muted">Yüzdelik dilim = sıra / katılımcı sayısı × 100. Daha düşük değer daha iyi sıralamayı gösterir.</p><dl className="grid grid-cols-2 gap-3 border-t border-border p-4 lg:grid-cols-4">{Object.entries(rankingLabels).map(([scope, label]) => {
      const ranking = exam.exam_rankings.find(row => row.scope === scope);
      return <div key={scope} className="min-w-0 p-2"><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 font-semibold tabular-nums">{ranking ? <>{number(ranking.rank, 0)}. <span className="font-normal text-muted">/ {number(ranking.participant_count, 0)} kişi</span>{ranking.participant_count > 0 && <span className="mt-2 block text-sm text-accent">Yüzdelik dilim: {formatPercent(ranking.rank / ranking.participant_count)}</span>}</> : "Veri yok"}</dd></div>;
    })}</dl></section>
    <StudyAnalysisSection analysis={studyAnalysis} exam={exam} />
    <div className="mt-9"><QuestionAnalysis groups={groupQuestions(exam.exam_subject_results, exam.exam_questions)} /></div>
  </div></main>;
}
