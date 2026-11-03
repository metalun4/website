import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getExams } from "@/lib/exams";
import { queryValue, type Query } from "@/lib/yks-navigation";
import { yks26TytNet } from "@/lib/yks26-tyt";
import { AccountBar } from "../account-bar";
import { LazyDetails } from "../../lazy-details";
import { AdvancedAnalytics, type AnalyticsExam } from "../analytics";
import Chart from "../chart";
import { dateLabel, difference, calculateExam, movingAverage3, number, subjects, visibleSlice } from "../data";

export const metadata: Metadata = {
  title: "TYT Gelişim Paneli | YKS 2027",
  description: "TYT net gelişimi, ders sonuçları ve ayrıntılı performans analizi.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type CalculatedExam = ReturnType<typeof calculateExam> & { id: string };

function signed(value: number | null) {
  return number(value, 2, true);
}

function EmptyDashboard({ admin }: { admin: boolean }) {
  return <main className="yks-page"><div className="mx-auto max-w-7xl">
    <AccountBar admin={admin} />
    <h1 id="yks-content" tabIndex={-1} className="text-2xl font-semibold">Henüz deneme kaydı yok</h1>
    <p className="mt-3 text-muted">İlk deneme eklendiğinde gelişim grafiklerin burada görünecek.</p>
    <Link href={admin ? "/yks27/admin" : "/yks27/tyt"} className="yks-button mt-5">{admin ? "İlk denemeyi ekle" : "TYT denemelerine git"}</Link>
  </div></main>;
}

function SummaryCards({ latest, previous }: { latest: CalculatedExam; previous?: CalculatedExam }) {
  const cards = [
    { label: "Son toplam net", value: number(latest.net), detail: "120 soru üzerinden", featured: true },
    { label: "Önceki denemeye göre", value: previous ? signed(difference(latest.net, previous.net)) : "—", detail: previous ? `${dateLabel(previous.date)} tarihine göre` : "İlk denemen" },
    { label: "Ortalamaya göre", value: signed(latest.relative), detail: `Sınav ortalaması: ${number(latest.average)}` },
  ];
  return <dl className="mb-5 grid grid-cols-3 gap-2 sm:gap-4" aria-label="Son sınav özeti">
    {cards.map(card => <div key={card.label} className={`min-w-0 rounded-xl border border-border p-3 sm:p-5 ${card.featured ? "yks-featured" : "bg-surface"}`}>
      <dt className="min-h-9 text-xs leading-4 text-muted sm:min-h-0">{card.label}</dt>
      <dd className="mt-2 break-words text-[clamp(1.25rem,5vw,1.875rem)] font-semibold tabular-nums">{card.value}</dd>
      <p className="mt-2 text-xs leading-5 text-muted">{card.detail}</p>
    </div>)}
  </dl>;
}

function Comparisons({ latest, first }: { latest: CalculatedExam; first: CalculatedExam }) {
  const comparisons = [
    { title: "İlk denemeye göre gelişim", baseline: first.net },
    { title: "YKS 2026 TYT’ye göre gelişim", baseline: yks26TytNet },
  ];
  return <section aria-label="Sınav karşılaştırmaları" className="mb-7 grid gap-3 sm:grid-cols-2">
    {comparisons.map(comparison => <div key={comparison.title} className="yks-panel min-w-0">
      <h2 className="text-sm font-medium">{comparison.title}</h2>
      <dl className="mt-3 flex items-baseline justify-between gap-3">
        <dt className="text-sm text-muted">Net farkı</dt>
        <dd className="text-2xl font-semibold tabular-nums">{signed(difference(latest.net, comparison.baseline))}</dd>
      </dl>
    </div>)}
  </section>;
}

function SubjectSnapshot({ latest }: { latest: CalculatedExam }) {
  return <section className="my-7" aria-labelledby="subject-heading">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 id="subject-heading" className="text-lg font-semibold">Son denemede derslerin</h2>
      <span className="flex flex-wrap gap-x-4 gap-y-2"><Link href="/yks27/tyt/topics" className="inline-flex items-center text-accent hover:underline">Konu başarısını incele</Link><Link href={`/yks27/tyt/${latest.id}#konu-analizi`} className="inline-flex items-center text-accent hover:underline">Soru analizini incele</Link></span>
    </div>
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {subjects.map((subject, index) => <div key={subject.key} className="yks-panel">
        <dt className="text-sm text-muted">{subject.label}</dt>
        <dd className="mt-2 text-2xl font-semibold tabular-nums">{number(latest.subjects[index].net)} <span className="text-xs font-normal text-muted">/ {subject.questions} net</span></dd>
        <p className="mt-2 text-xs text-muted">{number(latest.subjects[index].correct, 0)} doğru · {number(latest.subjects[index].incorrect, 0)} yanlış · {number(latest.subjects[index].empty, 0)} boş</p>
      </div>)}
    </dl>
  </section>;
}

function RangeNav({ range }: { range: string }) {
  const items = [{ value: "5", label: "Son 5" }, { value: "10", label: "Son 10" }, { value: "all", label: "Tümü" }];
  return <nav aria-label="Grafik dönemi" className="flex flex-wrap gap-2">
    {items.map(item => <Link key={item.value} href={`?range=${item.value}`} scroll={false} aria-current={range === item.value ? "true" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm ${range === item.value ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border hover:bg-surface-muted"}`}>{item.label}</Link>)}
  </nav>;
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
  const exams = visibleSlice(all, range);
  // SMA-3 uses the full chronological history; the shared range filter only hides exams.
  const trend = visibleSlice(movingAverage3(all.map(exam => exam.net)), range);
  const points = toAnalytics(exams, trend);
  return <main className="yks-page"><div className="mx-auto max-w-7xl">
    <AccountBar admin={current.role === "admin"} />
    <header className="mb-5">
      <h1 id="yks-content" tabIndex={-1} className="text-3xl font-semibold tracking-tight">TYT gelişimin</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Son deneme: <Link href={`/yks27/tyt/${latest.id}`} className="text-foreground hover:underline">{latest.name}</Link> · {dateLabel(latest.date)}</p>
    </header>
    <SummaryCards latest={latest} previous={previous} />
    <div className="w-full min-w-0">
      <Comparisons latest={latest} first={all[0]} />
      <section aria-labelledby="trend-heading" className="mb-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="trend-heading" className="text-lg font-semibold">Net gelişimi</h2>
          <RangeNav range={range} />
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
