import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getExams } from "@/lib/exams";
import { queryValue, type Query } from "@/lib/yks-navigation";
import { yks26Tyt, yks26TytNet, yks26TytOutperformed } from "@/lib/yks26-tyt";
import { AccountBar } from "../account-bar";
import { LazyDetails } from "../../lazy-details";
import { AdvancedAnalytics } from "../analytics";
import Chart from "../chart";
import { dateLabel, difference, calculateExam, movingAverage3, number, subjects, visibleSlice } from "../data";

export const metadata: Metadata = {
  title: "TYT Gelişim Paneli | YKS 2027",
  description: "TYT net gelişimi, ders sonuçları ve ayrıntılı performans analizi.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function TytDashboard({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const range = ["5", "10"].includes(queryValue(query.range)) ? queryValue(query.range) : "all";
  const current = await requireSession(`/yks27/tyt/dashboard${queryValue(query.range) ? `?range=${range}` : ""}`);
  const all = (await getExams()).map(exam => ({ ...calculateExam(exam), id: exam.id }));
  const latest = all.at(-1), previous = all.at(-2);
  if (!latest) return <main className="yks-page"><div className="mx-auto max-w-7xl"><AccountBar admin={current.role === "admin"} /><h1 id="yks-content" tabIndex={-1} className="text-2xl font-semibold">Henüz deneme kaydı yok</h1><p className="mt-3 text-muted">İlk deneme eklendiğinde gelişim grafiklerin burada görünecek.</p><Link href={current.role === "admin" ? "/yks27/admin" : "/yks27/tyt"} className="yks-button mt-5">{current.role === "admin" ? "İlk denemeyi ekle" : "TYT denemelerine git"}</Link></div></main>;
  const exams = visibleSlice(all, range);
  // SMA-3 uses the full chronological history; the shared range filter only hides exams.
  const trend = visibleSlice(movingAverage3(all.map(exam => exam.net)), range);
  const chartExams = exams.map(({ id, name, date }) => ({ id, name, date }));
  const bySubject = (key: "relative" | "index" | "accuracy" | "dps") => subjects.map((_, index) => exams.map(exam => exam.subjects[index][key]));
  const cards = [
    { label: "Son toplam net", value: number(latest.net), detail: "120 soru üzerinden", featured: true },
    { label: "Önceki denemeye göre", value: previous ? number(difference(latest.net, previous.net), 2, true) : "—", detail: previous ? `${dateLabel(previous.date)} tarihine göre` : "İlk denemen" },
    { label: "Ortalamaya göre", value: number(latest.relative, 2, true), detail: `Sınav ortalaması: ${number(latest.average)}` },
  ];
  return <main className="yks-page"><div className="mx-auto max-w-7xl">
    <AccountBar admin={current.role === "admin"} />
    <header className="mb-5"><h1 id="yks-content" tabIndex={-1} className="text-3xl font-semibold tracking-tight">TYT gelişimin</h1><p className="mt-2 text-sm leading-6 text-muted">Son deneme: <Link href={`/yks27/tyt/${latest.id}`} className="text-foreground hover:underline">{latest.name}</Link> · {dateLabel(latest.date)}</p></header>
    <dl className="mb-5 grid grid-cols-3 gap-2 sm:gap-4" aria-label="Son sınav özeti">{cards.map(card => <div key={card.label} className={`min-w-0 rounded-xl border border-border p-3 sm:p-5 ${card.featured ? "yks-featured" : "bg-surface"}`}><dt className="min-h-9 text-xs leading-4 text-muted sm:min-h-0">{card.label}</dt><dd className="mt-2 break-words text-[clamp(1.25rem,5vw,1.875rem)] font-semibold tabular-nums">{card.value}</dd><p className="mt-2 text-xs leading-5 text-muted">{card.detail}</p></div>)}</dl>
    <section aria-label="Sınav karşılaştırmaları" className="mb-7 rounded-lg bg-surface-muted p-4 text-sm">
      <h2 className="font-semibold">İlk denemeye göre gelişim</h2>
      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div><dt className="text-muted">Net farkı</dt><dd className="mt-2 font-semibold tabular-nums">{number(difference(latest.net, all[0].net), 2, true)}</dd></div>
        <div><dt className="text-muted">Yüzdelik farkı</dt><dd className="mt-2 font-semibold tabular-nums">{number(difference(latest.outperformed, all[0].outperformed), 2, true)} yüzde puan</dd></div>
        <div><dt className="text-muted">Puan farkı</dt><dd className="mt-2 font-semibold tabular-nums">{number(difference(latest.score ?? null, all[0].score ?? null), 2, true)}</dd></div>
      </dl>
      <div className="mt-5 border-t border-border pt-4"><h2 className="font-semibold">YKS26 TYT’ye göre gelişim</h2><p className="mt-2 text-xs leading-6 text-muted">YKS26 TYT: {number(yks26TytNet)} net · {number(yks26Tyt.score, 5)} puan · {number(yks26Tyt.rank, 0)}. sıra / {number(yks26Tyt.participants, 0)} katılımcı</p>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div><dt className="text-muted">Net farkı</dt><dd className="mt-2 font-semibold tabular-nums">{number(difference(latest.net, yks26TytNet), 2, true)}</dd></div>
          <div><dt className="text-muted">Yüzdelik farkı</dt><dd className="mt-2 font-semibold tabular-nums">{number(difference(latest.outperformed, yks26TytOutperformed), 2, true)} yüzde puan</dd></div>
          <div><dt className="text-muted">Puan farkı</dt><dd className="mt-2 font-semibold tabular-nums">{number(difference(latest.score ?? null, yks26Tyt.score), 2, true)}</dd></div>
        </dl>
      </div>
    </section>
    <section className="my-7" aria-labelledby="subject-heading"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 id="subject-heading" className="text-lg font-semibold">Son denemede derslerin</h2><Link href={`/yks27/tyt/${latest.id}#konu-analizi`} className="inline-flex items-center text-accent hover:underline">Soru analizini incele →</Link></div><dl className="grid grid-cols-2 gap-3 md:grid-cols-4">{subjects.map((subject, i) => <div key={subject.key} className="yks-panel"><dt className="text-sm text-muted">{subject.label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{number(latest.subjects[i].net)} <span className="text-xs font-normal text-muted">/ {subject.questions} net</span></dd><p className="mt-2 text-xs text-muted">{number(latest.subjects[i].correct, 0)} doğru · {number(latest.subjects[i].incorrect, 0)} yanlış · {number(latest.subjects[i].empty, 0)} boş</p></div>)}</dl></section>
    <div className="w-full min-w-0">
      <section aria-labelledby="trend-heading" className="mb-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 id="trend-heading" className="text-lg font-semibold">Net gelişimi</h2><nav aria-label="Grafik dönemi" className="flex flex-wrap gap-2">{[{ value: "5", label: "Son 5" }, { value: "10", label: "Son 10" }, { value: "all", label: "Tümü" }].map(item => <Link key={item.value} href={`?range=${item.value}`} scroll={false} aria-current={range === item.value ? "true" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm ${range === item.value ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border hover:bg-surface-muted"}`}>{item.label}</Link>)}</nav></div>
        <p className="mb-3 text-xs text-muted">{exams.length} / {all.length} deneme · {dateLabel(exams[0].date)} — {dateLabel(latest.date)}</p>
        <Chart exams={chartExams} title="Toplam net ve sınav ortalaması" description="Her denemede netin ile o sınavın katılımcı ortalamasını karşılaştır." unit=" net" series={[{ label: "Toplam net", color: "var(--chart-primary)", values: exams.map(exam => exam.net) }, { label: "Sınav ortalaması", color: "var(--chart-secondary)", values: exams.map(exam => exam.average) }]} />
      </section>
      <LazyDetails label="Ayrıntılı analiz · Performans, doğruluk ve DPS">
        <AdvancedAnalytics
          exams={chartExams}
          net={exams.map(exam => exam.net)}
          trend={trend}
          outperformed={exams.map(exam => exam.outperformed)}
          performanceIndex={exams.map(exam => exam.index)}
          relative={bySubject("relative")}
          subjectIndex={bySubject("index")}
          accuracy={exams.map(exam => exam.accuracy)}
          subjectAccuracy={bySubject("accuracy")}
          dps={exams.map(exam => exam.dps)}
          subjectDps={bySubject("dps")}
        />
      </LazyDetails>
    </div>
  </div></main>;
}
