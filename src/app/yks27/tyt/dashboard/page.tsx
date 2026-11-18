import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getExams } from "@/lib/exams";
import { loadStudyAnalysis } from "@/lib/topic-study";
import { queryValue, type Query } from "@/lib/yks-navigation";
import { yks26Tyt, yks26TytNet } from "@/lib/yks26-tyt";
import { LazyDetails } from "../../lazy-details";
import { AdvancedAnalytics, type AnalyticsExam } from "../analytics";
import Chart from "../chart";
import { dateLabel, difference, calculateExam, movingAverage3, number, subjects, visibleSlice } from "../data";
import { StudyDashboardSummary } from "./study-summary";

export const metadata: Metadata = {
  title: "TYT Gelişim Paneli | YKS 2027",
  description: "TYT net gelişimi, ders sonuçları ve ayrıntılı performans analizi.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

import { SummaryStrip, WorkspaceEmpty } from "../../workspace-ui";
import { RangeControl } from "../../url-controls";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type CalculatedExam = ReturnType<typeof calculateExam> & { id: string };

function signed(value: number | null) {
  return number(value, 2, true);
}

function EmptyDashboard({ admin }: { admin: boolean }) {
  return <main className="yks-page"><div><h1 id="yks-content" tabIndex={-1} className="mb-6">TYT gelişimin</h1><WorkspaceEmpty title="Henüz deneme kaydı yok" href={admin ? "/yks27/admin" : "/yks27/tyt"} action={admin ? "İlk denemeyi ekle" : "TYT denemelerine git"}>İlk deneme eklendiğinde gelişim grafiklerin burada görünecek.</WorkspaceEmpty></div></main>;
}
function SummaryCards({ latest, previous }: { latest: CalculatedExam; previous?: CalculatedExam }) {
  return <SummaryStrip label="Son sınav özeti" items={[
    { label: "Son toplam net", value: number(latest.net), detail: "120 soru üzerinden", lead: true },
    { label: "Önceki denemeye göre", value: previous ? signed(difference(latest.net, previous.net)) : "—", detail: previous ? `${dateLabel(previous.date)} tarihine göre` : "İlk denemen" },
    { label: "Ortalamaya göre", value: signed(latest.relative), detail: `Sınav ortalaması: ${number(latest.average)}` },
  ]} />;
}
function Comparisons({ latest, first }: { latest: CalculatedExam; first: CalculatedExam }) {
  return <SummaryStrip label="Sınav karşılaştırmaları" className="yks-comparisons" items={[
    { label: "İlk denemeye göre gelişim", value: signed(difference(latest.net, first.net)), detail: `Net farkı · İlk deneme: ${number(first.net)}` },
    { label: "YKS 2026 TYT’ye göre gelişim", value: signed(difference(latest.net, yks26TytNet)), detail: <>Net farkı · YKS26 TYT: {number(yks26TytNet)}<br />Puan farkı: {signed(difference(latest.score ?? null, yks26Tyt.score))}</> },
  ]} />;
}
function SubjectSnapshot({ latest }: { latest: CalculatedExam }) {
  return <Card className="yks-subject-card mb-7"><CardHeader className="yks-band"><CardTitle><h2 id="subject-heading">Son denemede derslerin</h2></CardTitle><Link href="/yks27/tyt/topics" className="text-sm text-accent hover:underline">Konu başarısını incele</Link></CardHeader><CardContent className="yks-subject-content"><Table className="yks-karne"><TableHeader><TableRow><TableHead scope="col">Ders</TableHead><TableHead scope="col">Net / Soru</TableHead><TableHead scope="col">D</TableHead><TableHead scope="col">Y</TableHead><TableHead scope="col">B</TableHead></TableRow></TableHeader><TableBody>{subjects.map((subject,index) => <TableRow key={subject.key}><TableHead scope="row">{subject.label}</TableHead><TableCell>{number(latest.subjects[index].net)} / {subject.questions}</TableCell><TableCell data-outcome="correct">{number(latest.subjects[index].correct,0)}</TableCell><TableCell data-outcome="incorrect">{number(latest.subjects[index].incorrect,0)}</TableCell><TableCell>{number(latest.subjects[index].empty,0)}</TableCell></TableRow>)}</TableBody></Table><p className="px-6 py-3 text-sm"><Link href={`/yks27/tyt/${latest.id}#konu-analizi`} className="text-accent hover:underline">Soru analizini incele</Link></p></CardContent></Card>;
}

function toAnalytics(exams: CalculatedExam[], trend: readonly (number | null)[]): AnalyticsExam[] {
  return exams.map((exam, index) => ({
    id: exam.id,
    name: exam.name,
    date: exam.date,
    net: exam.net,
    trend: trend[index] ?? null,
    outperformed: exam.outperformed,
    index: exam.index,
    accuracy: exam.accuracy,
    dps: exam.dps,
    subjects: exam.subjects.map(subject => ({
      relative: subject.relative,
      index: subject.index,
      accuracy: subject.accuracy,
      dps: subject.dps,
    })),
  }));
}

export default async function TytDashboard({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const requested = queryValue(query.range);
  const range = requested === "5" || requested === "10" ? requested : "all";
  const current = await requireSession(`/yks27/tyt/dashboard${queryValue(query.range) ? `?range=${range}` : ""}`);
  const all = (await getExams()).map(exam => ({ ...calculateExam(exam), id: exam.id }));
  const latest = all.at(-1);
  const previous = all.at(-2);
  if (!latest) return <EmptyDashboard admin={current.role === "admin"} />;
  const studyAnalysis = await loadStudyAnalysis(latest.id, false).catch(() => null);
  const exams = visibleSlice(all, range);
  // SMA-3 uses the full chronological history; the shared range filter only hides exams.
  const trend = visibleSlice(movingAverage3(all.map(exam => exam.net)), range);
  const points = toAnalytics(exams, trend);
  return <main className="yks-page"><div className="mx-auto max-w-7xl">
    <header className="mb-5">
      <h1 id="yks-content" tabIndex={-1} className="text-3xl font-semibold tracking-tight">TYT gelişimin</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Son deneme: <Link href={`/yks27/tyt/${latest.id}`} className="text-foreground hover:underline">{latest.name}</Link> · {dateLabel(latest.date)}</p>
    </header>
    <StudyDashboardSummary analysis={studyAnalysis} examId={latest.id} />
    <SummaryCards latest={latest} previous={previous} />
    <div className="w-full min-w-0">
      <Comparisons latest={latest} first={all[0]} />
      <section aria-labelledby="trend-heading" className="mb-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="trend-heading" className="text-lg font-semibold">Net gelişimi</h2>
          <RangeControl value={range} label="Grafik dönemi" />
        </div>
        <p className="mb-3 text-xs text-muted">{exams.length} / {all.length} deneme · {dateLabel(exams[0].date)} — {dateLabel(latest.date)}</p>
        <Chart
          exams={points}
          title="Toplam net ve sınav ortalaması"
          description="Her denemede netin ile o sınavın katılımcı ortalamasını karşılaştır."
          unit=" net"
          series={[
            { label: "Toplam net", color: "var(--chart-primary)", values: points.map(exam => exam.net) },
            { label: "Sınav ortalaması", color: "var(--chart-secondary)", values: exams.map(exam => exam.average) },
          ]}
        />
      </section>
      <SubjectSnapshot latest={latest} />
      <LazyDetails label="Ayrıntılı analiz · Performans, doğruluk ve DPS">
        <AdvancedAnalytics exams={points} trendIncludesHidden={range !== "all" && exams.length < all.length} />
      </LazyDetails>
    </div>
  </div></main>;
}
