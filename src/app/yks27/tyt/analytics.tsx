"use client";

import { useId, useState, type ReactNode } from "react";
import Chart, { type Series } from "./chart";
import { chartScaleDomain } from "./chart-model";
import { subjects } from "./data";
import { SegmentedControl } from "./segmented-control";

type SubjectPoint = {
  relative: number | null;
  index: number | null;
  accuracy: number | null;
  dps: number | null;
};
export type AnalyticsExam = {
  id: string;
  name: string;
  date: string;
  net: number | null;
  trend: number | null;
  outperformed: number | null;
  index: number | null;
  accuracy: number | null;
  dps: number | null;
  subjects: readonly SubjectPoint[];
};
type SubjectKey = (typeof subjects)[number]["key"];
type ChartView = {
  title: string;
  description: ReactNode;
  series: Series[];
  unit?: string;
  domain?: readonly [number, number];
  reference?: number;
  referenceNote?: string;
};

const overallMetrics = [
  { value: "trend", label: "Net eğilimi" },
  { value: "outperformed", label: "Geride bırakılan" },
  { value: "index", label: "Performans endeksi" },
] as const;
const subjectMetrics = [
  { value: "relative", label: "Göreli net" },
  { value: "index", label: "Performans endeksi" },
] as const;
const accuracyMetrics = [
  { value: "accuracy", label: "Doğruluk" },
  { value: "dps", label: "DPS" },
] as const;
const subjectOptions = subjects.map(subject => ({ value: subject.key, label: subject.label }));
const scopeOptions = [{ value: "overall" as const, label: "Genel" }, ...subjectOptions];

function subjectAt(key: SubjectKey) {
  const index = subjects.findIndex(subject => subject.key === key);
  return { index: index < 0 ? 0 : index, subject: subjects[index < 0 ? 0 : index] };
}

function AnalyticsSection({ title, description, controls, children, note }: {
  title: string;
  description: string;
  controls: ReactNode;
  children: ReactNode;
  note?: ReactNode;
}) {
  const headingId = useId();
  return <section className="min-w-0" aria-labelledby={headingId}>
    <h2 id={headingId} className="text-xl font-semibold">{title}</h2>
    <p className="mt-2 mb-4 text-sm leading-6 text-muted">{description}</p>
    <div className="mb-4">{controls}</div>
    {children}
    {note ? <p className="mt-3 text-xs leading-5 text-muted">{note}</p> : null}
  </section>;
}

function OverallPerformance({ exams, trendIncludesHidden }: { exams: readonly AnalyticsExam[]; trendIncludesHidden: boolean }) {
  const [metric, setMetric] = useState<(typeof overallMetrics)[number]["value"]>("trend");
  const ready = exams.some(exam => exam.trend !== null && Number.isFinite(exam.trend));
  const views: Record<(typeof overallMetrics)[number]["value"], ChartView> = {
    trend: {
      title: "Net eğilimi",
      description: <>Kalın çizgi 3 denemelik hareketli ortalamadır (<span translate="no">SMA-3</span>). Kesikli çizgi gerçek toplam nettir. Geçerli 3 ardışık deneme yoksa ortalama boş kalır.{trendIncludesHidden ? " Bu aralığın başındaki ortalamalar, pencereden önceki denemeleri de kullanır." : null}</>,
      unit: " net",
      series: [
        { label: "3 deneme ortalaması", color: "var(--chart-primary)", values: exams.map(exam => exam.trend), emphasis: "primary", curve: "monotone" },
        { label: "Gerçek toplam net", color: "var(--chart-secondary)", values: exams.map(exam => exam.net), emphasis: "secondary" },
      ],
    },
    outperformed: {
      title: "Geride bırakılan katılımcı oranı",
      description: "Bu sınavın katılımcıları arasındaki konumun.",
      unit: "%",
      domain: [0, 100],
      series: [{ label: "Geride bırakılan", color: "var(--chart-primary)", values: exams.map(exam => exam.outperformed) }],
    },
    index: {
      title: "Performans endeksi",
      description: "Net / sınav ortalaması × 100.",
      reference: 100,
      referenceNote: "Kesikli çizgi sınav ortalamasını (100) gösterir.",
      series: [{ label: "Performans endeksi", color: "var(--chart-primary)", values: exams.map(exam => exam.index) }],
    },
  };
  const view = views[metric];
  return <AnalyticsSection title="Genel performans" description="Bir metrik seç. Net eğilimi son 3 denemenin ortalamasıdır; diğer metrikler o sınavın kendi sonucudur." controls={<SegmentedControl label="Metrik" value={metric} options={overallMetrics} onChange={setMetric} />}>
    {metric === "trend" && !ready ? <p className="mb-3 text-xs leading-5 text-muted" role="status">Bu aralıkta 3 ardışık geçerli net yok. Eğilim çizgisi boş kalır; gerçek netler gösterilir.</p> : null}
    <Chart exams={exams} {...view} />
  </AnalyticsSection>;
}

function SubjectPerformance({ exams }: { exams: readonly AnalyticsExam[] }) {
  const [metric, setMetric] = useState<(typeof subjectMetrics)[number]["value"]>("relative");
  const [subjectKey, setSubjectKey] = useState<SubjectKey>(subjects[0].key);
  const { index, subject } = subjectAt(subjectKey);
  const reference = metric === "relative" ? 0 : 100;
  const domain = chartScaleDomain(exams.flatMap(exam => exam.subjects.map(item => item[metric])), undefined, reference);
  const values = exams.map(exam => exam.subjects[index]?.[metric] ?? null);
  const view: ChartView = metric === "relative"
    ? {
        title: `${subject.label} göreli net`,
        description: "Ders netin − ders ortalaması. Pozitif değer ortalamanın üstüdür.",
        unit: " net",
        domain,
        reference,
        referenceNote: "Kesikli çizgi sıfırdır ve sınav ortalamasını gösterir.",
        series: [{ label: "Göreli net", color: subject.color, values }],
      }
    : {
        title: `${subject.label} performans endeksi`,
        description: "Ders neti / ders ortalaması × 100.",
        domain,
        reference,
        referenceNote: "Kesikli çizgi sınav ortalamasını (100) gösterir.",
        series: [{ label: "Performans endeksi", color: subject.color, values }],
      };
  return <AnalyticsSection
    title="Ders performansı"
    description="Bir ders ve bir metrik seç. Değerler o dersin kendi ortalamasına göredir. Ders değiştirmek ölçeği değiştirmez."
    controls={<div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <SegmentedControl label="Metrik" value={metric} options={subjectMetrics} onChange={setMetric} />
      <SegmentedControl label="Ders" value={subjectKey} options={subjectOptions} onChange={setSubjectKey} />
    </div>}
  >
    <Chart exams={exams} {...view} />
  </AnalyticsSection>;
}

function AccuracyPerformance({ exams }: { exams: readonly AnalyticsExam[] }) {
  const [metric, setMetric] = useState<(typeof accuracyMetrics)[number]["value"]>("accuracy");
  const [scope, setScope] = useState<"overall" | SubjectKey>("overall");
  const subject = scope === "overall" ? null : subjectAt(scope);
  const domain = chartScaleDomain(exams.flatMap(exam => [
    exam.accuracy,
    exam.dps,
    ...exam.subjects.flatMap(item => [item.accuracy, item.dps]),
  ]), [0, 100]);
  const values = exams.map(exam => subject ? exam.subjects[subject.index]?.[metric] ?? null : exam[metric]);
  const label = subject ? subject.subject.label : "Genel";
  const color = subject ? subject.subject.color : "var(--chart-primary)";
  const view: ChartView = metric === "accuracy"
    ? {
        title: subject ? `${label} doğruluğu` : "Genel doğruluk",
        description: subject ? "Bu dersin doğru ve yanlış sayılarına göre. Boş sorular dahil değildir." : "İşaretlediğin soruların doğru cevaplanma oranı. Boş sorular dahil değildir.",
        unit: "%",
        domain,
        series: [{ label: "Doğruluk", color, values }],
      }
    : {
        title: subject ? `${label} DPS` : "Genel DPS",
        description: subject ? "Bu dersin doğruluk ve işaretleme oranına göre. Resmi sınav puanı değildir." : "Doğruluk ile işaretleme oranının harmonik ortalaması. Resmi sınav puanı değildir.",
        domain,
        series: [{ label: "DPS", color, values }],
      };
  return <AnalyticsSection
    title="Doğruluk ve DPS"
    description="Doğruluk boş soruları saymaz. DPS resmi puan değildir. Her iki metrik 0–100 ölçeğindedir."
    controls={<div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <SegmentedControl label="Metrik" value={metric} options={accuracyMetrics} onChange={setMetric} />
      <SegmentedControl label="Kapsam" value={scope} options={scopeOptions} onChange={setScope} />
    </div>}
    note="DPS = 200 × doğruluk × işaretleme oranı / (doğruluk + işaretleme oranı). Oranlar 0–1 aralığındadır. Türkçe ve matematik 40, sosyal ve fen 20 sorudur."
  >
    <Chart exams={exams} {...view} />
  </AnalyticsSection>;
}

export function AdvancedAnalytics({ exams, trendIncludesHidden = false }: {
  exams: readonly AnalyticsExam[];
  trendIncludesHidden?: boolean;
}) {
  return <div className="flex w-full min-w-0 flex-col gap-8 pt-1">
    <OverallPerformance exams={exams} trendIncludesHidden={trendIncludesHidden} />
    <SubjectPerformance exams={exams} />
    <AccuracyPerformance exams={exams} />
  </div>;
}
